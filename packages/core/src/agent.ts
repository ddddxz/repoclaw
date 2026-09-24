import type { ISandboxRunner } from "@repoclaw/sandbox";
import type { TaskStatus, TaskStep, ReproPlan, Reflection } from "@repoclaw/shared";
import { inspectRepo, type UniversalRepoMetadata } from "./git.js";
import { MockLlmProvider, type ILLMProvider } from "./llm.js";
import { matchExecutionTraceback, type MatchResult } from "./matcher.js";

export interface ReproAgentOptions {
  repoDir: string;
  issueTitle: string;
  issueBody: string;
  maxRetries?: number;
  sandboxTimeoutMs?: number;
  llmProvider: ILLMProvider;
  sandboxRunner: ISandboxRunner;
  onStepChange?: (step: TaskStep, detail: string) => void;
}

export interface AgentReproResult {
  status: TaskStatus;
  targetException: string;
  finalScript: string;
  actualTraceback: string;
  retryCount: number;
  durationMs: number;
  markdownReport: string;
  matchResult: MatchResult;
  logs: string[];
}

/**
 * RepoClaw Agent 核心状态机控制器 (吸收自 DeepSeek Harness 自愈反思闭环)
 */
export class ReproAgent {
  private options: ReproAgentOptions;
  private logs: string[] = [];

  constructor(options: ReproAgentOptions) {
    this.options = options;
  }

  private log(message: string) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(entry);
  }

  /**
   * 执行完整的意图推导、沙箱验证与自愈反思流水线
   */
  async execute(): Promise<AgentReproResult> {
    const startTime = Date.now();
    const maxRetries = this.options.maxRetries ?? 3;
    let retryCount = 0;

    // 1. [INIT/CLONING]: 探测仓库结构并进行 AST 符号抽取
    this.options.onStepChange?.("CLONING", "正在预处理目标仓库模块与结构并分析 AST 语法树...");
    this.log("正在探测目标仓库环境并静态提取 AST 代码骨架...");
    const keywords = [
      ...this.options.issueTitle.split(/[\s,:;()\[\]{}]+/),
      ...this.options.issueBody.slice(0, 500).split(/[\s,:;()\[\]{}]+/),
    ].filter((w) => w.length > 2);
    const meta: UniversalRepoMetadata = await inspectRepo(this.options.repoDir, keywords);
    const outlineCount = meta.astOutlines?.length ?? 0;
    this.log(`目标仓库探测完成：语言 [${meta.language}]，发现模块 [${meta.packageNames.join(", ")}]，已精准提取 ${outlineCount} 个模块的 AST 符号骨架`);

    // 2. [GENERATING]: 大模型生成首轮复现计划
    this.options.onStepChange?.("GENERATING", "大模型正在推导 Issue 意图并合成最小单文件测试用例...");
    this.log("调用大模型生成 ReproPlan...");
    let plan: ReproPlan;
    try {
      plan = await this.options.llmProvider.generateReproPlan(
        meta,
        this.options.issueTitle,
        this.options.issueBody
      );
      this.log(`首轮计划生成完成：预期异常: ${plan.targetException}，触发原理: ${plan.explanation}`);
    } catch (llmErr) {
      const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      this.log(`⚠️ 大模型生成计划遭遇网络或认证异常 (${errMsg})，自动启用本地确定性推导容灾引擎...`);
      const fallback = new MockLlmProvider();
      plan = await fallback.generateReproPlan(meta, this.options.issueTitle, this.options.issueBody);
      this.log(`本地推导计划就绪：预期异常: ${plan.targetException}，触发原理: ${plan.explanation}`);
    }

    let currentScript = plan.reproScript;
    let finalTraceback = "";
    let lastMatch: MatchResult | null = null;
    let finalStatus: TaskStatus = "FAILED";

    // 3. 进入执行与自愈反思闭环 (Reflection Loop)
    while (retryCount <= maxRetries) {
      this.options.onStepChange?.(
        "SANDBOX_RUN",
        `正在隔离沙箱中执行测试脚本 (第 ${retryCount + 1} 次尝试)...`
      );
      this.log(`第 ${retryCount + 1} 次沙箱隔离执行启动...`);

      const executionOutput = await this.options.sandboxRunner.run({
        hostRepoDir: this.options.repoDir,
        scriptContent: currentScript,
        timeoutMs: this.options.sandboxTimeoutMs,
        language: meta.language === "unknown" ? undefined : meta.language,
      });

      finalTraceback = executionOutput.stderr;
      this.log(
        `沙箱执行结束：ExitCode=${executionOutput.exitCode}, 耗时=${executionOutput.durationMs}ms, 超时=${executionOutput.timedOut}`
      );

      // 堆栈特征比对
      const match = matchExecutionTraceback(
        plan.targetException,
        plan.errorKeywords,
        executionOutput.stderr,
        meta.language
      );
      lastMatch = match;
      this.log(`比对判定结果: ${match.reason} (Verified=${match.isVerified}, Recoverable=${match.isRecoverableError})`);

      // 命中目标异常：验证成功！
      if (match.isVerified) {
        finalStatus = "VERIFIED";
        this.log("🎉 成功捕获目标 Bug 异常，闭环验证完成！");
        break;
      }

      // 未命中，但如果还能重试
      if (retryCount < maxRetries) {
        retryCount++;
        this.options.onStepChange?.(
          "REFLECTING",
          `沙箱报错不匹配，反哺错误堆栈触发第 ${retryCount} / ${maxRetries} 轮自愈反思...`
        );
        this.log(`启动自愈反思修补 (第 ${retryCount} 轮)...`);

        let reflection: Reflection;
        try {
          reflection = await this.options.llmProvider.generateReflection(
            currentScript,
            executionOutput.stderr || executionOutput.stdout,
            retryCount
          );
        } catch (reflErr) {
          const errMsg = reflErr instanceof Error ? reflErr.message : String(reflErr);
          this.log(`⚠️ 大模型反思遭遇异常 (${errMsg})，启用启发式自愈回退策略...`);
          const fallback = new MockLlmProvider();
          reflection = await fallback.generateReflection(
            currentScript,
            executionOutput.stderr || executionOutput.stdout,
            retryCount
          );
        }

        this.log(`自愈分析结论: ${reflection.analysis} (动作类别: ${reflection.actionType})`);
        if (reflection.actionType === "ABORT") {
          this.log("Agent 判定无法继续自愈，主动终止重试");
          finalStatus = executionOutput.exitCode === 0 ? "UNVERIFIED" : "FAILED";
          break;
        }

        currentScript = reflection.patchedScript;
      } else {
        // 重试次数已达上限
        this.log(`已达到最大重试次数 (${maxRetries})，停止执行`);
        finalStatus = executionOutput.exitCode === 0 ? "UNVERIFIED" : "FAILED";
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    this.options.onStepChange?.("GITHUB_NOTIFY", "正在构建结构化回帖报告与状态标签...");

    const markdownReport = this.generateMarkdownReport({
      status: finalStatus,
      targetException: plan.targetException,
      finalScript: currentScript,
      traceback: finalTraceback,
      retryCount,
      durationMs,
      explanation: plan.explanation,
    });

    return {
      status: finalStatus,
      targetException: plan.targetException,
      finalScript: currentScript,
      actualTraceback: finalTraceback,
      retryCount,
      durationMs,
      markdownReport,
      matchResult: lastMatch!,
      logs: this.logs,
    };
  }

  /**
   * 生成符合 PRD FR-4.1 / FR-4.2 规范的结构化 GitHub Markdown 回帖内容
   */
  private generateMarkdownReport(data: {
    status: TaskStatus;
    targetException: string;
    finalScript: string;
    traceback: string;
    retryCount: number;
    durationMs: number;
    explanation: string;
  }): string {
    if (data.status === "VERIFIED") {
      return `### 🐾 RepoClaw 自动化 Bug 复现报告 (Verified)

> 机器人已成功在安全受限 Docker 沙箱中真实捕获并复现了目标异常 **\`${data.targetException}\`**！

#### 📌 最小独立复现代码 (可直接复制至 \`tests/\` 验证)
\`\`\`python
${data.finalScript}
\`\`\`

<details>
<summary><b>🔍 查看沙箱真实运行捕获的报错调用栈 (Traceback)</b></summary>

\`\`\`text
${data.traceback || "无标准错误输出"}
\`\`\`

</details>

<details>
<summary><b>⚙️ 执行环境指纹与审计参数</b></summary>

- **复现状态**: \`VERIFIED\` (已确证)
- **触发原理**: ${data.explanation}
- **自愈重试轮数**: ${data.retryCount} 轮
- **端到端总耗时**: ${(data.durationMs / 1000).toFixed(2)} 秒
- **沙箱隔离策略**: \`512MB RAM\` / \`1.0 CPU\` / \`Network: none\` / \`ReadonlyRootfs\`

</details>

---
*由 **RepoClaw** 自主维护者驱动合成 · 维护者可直接基于上述最小脚本进行修补验证*`;
    }

    // 未能验证或失败回帖
    return `### 🐾 RepoClaw 复现尝试反馈 (Clarification Needed)

机器人已尝试在沙箱隔离环境中运行推导脚本，但在当前默认参数下**未能复现出目标报错**。

#### 🧪 尝试运行的复现代码
\`\`\`python
${data.finalScript}
\`\`\`

<details>
<summary><b>📋 沙箱真实输出日志</b></summary>

\`\`\`text
${data.traceback || "执行正常退出，未捕获到目标异常。"}
\`\`\`

</details>

**💡 建议补充信息**：
请提报者或维护者协助补充触发该问题所需的特定入参、依赖版本或操作系统环境细节。`;
  }
}
