import type { RepoMetadata } from "./git.js";
import { formatAstOutlineForPrompt } from "./ast.js";

/**
 * 构建大模型首轮最小复现计划生成提示词
 */
export function buildReproPlanSystemPrompt(meta: RepoMetadata): string {
  const packagesList = meta.packageNames.length > 0 ? meta.packageNames.join(", ") : "标准库或根目录下模块";

  let astSection = "";
  if (meta.astOutlines && meta.astOutlines.length > 0) {
    const formattedStub = formatAstOutlineForPrompt(meta.astOutlines);
    if (formattedStub.trim().length > 0) {
      astSection = `\n\n【目标仓库核心代码符号骨架 (AST Python Stub)】:
以下是通过静态语法树从被测代码中抽取的真实类、方法与函数签名，请严格遵循这些真实签名与参数名进行调用，严禁凭空臆造不存在的函数：
\`\`\`python
${formattedStub}
\`\`\``;
    }
  }

  return `你是由 DeepMind 与开源维护者联合研发的 RepoClaw 智能复现 Agent。
你的唯一职责：深入阅读提报的 GitHub Issue，精准推导 Bug 触发条件，合成一段【最小、单文件、零外部多余依赖】的 Python 复现脚本（repro.py）。

【运行环境安全约束（强制遵循）】
1. 代码运行于严格隔离的只读 Docker 沙箱中，根文件系统只读，且【绝对无外网访问 (NetworkMode: none)】。
2. 绝对不能使用 pip install 安装任何额外依赖，仅允许使用 Python 3.11 标准库及目标仓库自身提供的源码模块。
3. 目标仓库代码已挂载至容器内部路径：\`${meta.pythonPathRelative}\`。
4. 目标仓库已探测到的可用核心包名：[ ${packagesList} ]。
5. 脚本头部必须加入环境路径注入代码：
   import sys
   sys.path.insert(0, '${meta.pythonPathRelative}')

【代码合成原则】
- 聚焦单一崩溃点：脚本目标是 100% 触发 Issue 报告中所描述的特定异常（TargetException）。
- 绝不修复 Bug：你合成的是【复现测试用例】，绝不要在脚本中对 Bug 进行修复或加 try-except 掩盖。
- 必须基于给定的 Zod Schema 输出结构化 ReproPlan。${astSection}`;
}

/**
 * 构建首轮 Issue 输入的用户 Prompt
 */
export function buildIssueUserPrompt(issueTitle: string, issueBody: string): string {
  return `请根据以下 GitHub Issue 提报内容，推导出触发 Bug 所需的核心参数与调用方式，生成最小复现脚本：

【Issue 标题】:
${issueTitle}

【Issue 正文与报错信息】:
${issueBody}`;
}

/**
 * 构建自愈反思修补 Prompt (吸收自 DeepSeek Harness 状态机反思机制)
 */
export function buildReflectionPrompt(
  previousScript: string,
  stderr: string,
  retryRound: number
): string {
  return `上一轮执行沙箱反馈未能成功触发目标 Bug。
这是第 ${retryRound} / 3 轮自愈反思。请根据沙箱返回的真实 Traceback 错误堆栈，分析原因并修正复现脚本：

【上一轮复现脚本】:
\`\`\`python
${previousScript}
\`\`\`

【沙箱真实 stderr 报错输出】:
\`\`\`text
${stderr}
\`\`\`

【反思指引】:
1. 若报错为 ModuleNotFoundError，请检查 import 模块路径是否正确，是否需要导入子模块或调整 sys.path；
2. 若报错为 SyntaxError / IndentationError，请直接修正语法；
3. 若正常退出（Exit 0 未报错），说明入参未达到边界溢出条件，请变异测试入参（如传入空值、极值或异常类型）；
4. 必须输出完整修正后的 patchedScript，保持单文件独立可运行。`;
}
