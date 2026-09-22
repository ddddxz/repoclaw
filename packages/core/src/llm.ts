import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  ReproPlanSchema,
  ReflectionSchema,
  type ReproPlan,
  type Reflection,
} from "@repoclaw/shared";
import type { RepoMetadata } from "./git.js";
import {
  buildReproPlanSystemPrompt,
  buildIssueUserPrompt,
  buildReflectionPrompt,
} from "./prompt.js";

/**
 * 大模型推理驱动统一接口
 */
export interface ILLMProvider {
  generateReproPlan(
    meta: RepoMetadata,
    issueTitle: string,
    issueBody: string
  ): Promise<ReproPlan>;

  generateReflection(
    previousScript: string,
    stderr: string,
    retryRound: number
  ): Promise<Reflection>;
}

/**
 * 基于 Vercel AI SDK 的工业级 LLM 驱动 (支持 DeepSeek-V3 / Qwen-2.5-Coder / OpenAI)
 */
export class VercelAILlmProvider implements ILLMProvider {
  private modelName: string;
  private apiKey: string;
  private baseURL: string;

  constructor(options?: { modelName?: string; apiKey?: string; baseURL?: string }) {
    this.modelName = options?.modelName || process.env.MODEL_NAME || "deepseek-chat";
    this.apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
    this.baseURL =
      options?.baseURL ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.deepseek.com/v1";
  }

  private getModel() {
    const provider = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });
    return provider(this.modelName);
  }

  async generateReproPlan(
    meta: RepoMetadata,
    issueTitle: string,
    issueBody: string
  ): Promise<ReproPlan> {
    const system = buildReproPlanSystemPrompt(meta);
    const prompt = buildIssueUserPrompt(issueTitle, issueBody);

    const { object } = await generateObject({
      model: this.getModel(),
      schema: ReproPlanSchema,
      system,
      prompt,
      temperature: 0.1,
    });

    return object;
  }

  async generateReflection(
    previousScript: string,
    stderr: string,
    retryRound: number
  ): Promise<Reflection> {
    const prompt = buildReflectionPrompt(previousScript, stderr, retryRound);

    const { object } = await generateObject({
      model: this.getModel(),
      schema: ReflectionSchema,
      system: "你是一个专业的 Python 调试专家，根据错误堆栈精准定位并修改复现测试代码。",
      prompt,
      temperature: 0.1,
    });

    return object;
  }
}

/**
 * 确定性仿真 LLM Provider (用于自动化单测与离线 Benchmark)
 */
export class MockLlmProvider implements ILLMProvider {
  private customReproPlan?: (title: string, body: string) => ReproPlan;
  private customReflection?: (stderr: string, round: number) => Reflection;

  constructor(options?: {
    customReproPlan?: (title: string, body: string) => ReproPlan;
    customReflection?: (stderr: string, round: number) => Reflection;
  }) {
    this.customReproPlan = options?.customReproPlan;
    this.customReflection = options?.customReflection;
  }

  async generateReproPlan(
    _meta: RepoMetadata,
    issueTitle: string,
    issueBody: string
  ): Promise<ReproPlan> {
    if (this.customReproPlan) {
      return this.customReproPlan(issueTitle, issueBody);
    }

    // 默认推导逻辑
    let targetException = "ValueError";
    if (issueTitle.includes("ZeroDivision") || issueBody.includes("ZeroDivisionError")) {
      targetException = "ZeroDivisionError";
    } else if (issueTitle.includes("KeyError") || issueBody.includes("KeyError")) {
      targetException = "KeyError";
    }

    let reproScript = `import sys\nsys.path.insert(0, '/workspace')\nresult = 1 / 0\n`;
    if (issueTitle.includes("divide_numbers") || issueBody.includes("divide_numbers")) {
      reproScript = `import sys\nsys.path.insert(0, '/workspace')\nfrom math_lib.calculator import divide_numbers\nresult = divide_numbers(10, 0)\n`;
    }

    return {
      targetException,
      errorKeywords: ["division by zero", "line"],
      reproScript,
      explanation: `通过传入除数为0触发 ${targetException}`,
    };
  }

  async generateReflection(
    previousScript: string,
    stderr: string,
    retryRound: number
  ): Promise<Reflection> {
    if (this.customReflection) {
      return this.customReflection(stderr, retryRound);
    }

    if (stderr.includes("ModuleNotFoundError")) {
      return {
        analysis: "上一轮未正确导入模块，添加 sys.path 修正路径",
        actionType: "PATCH_IMPORTS",
        patchedScript: `import sys\nsys.path.insert(0, '/workspace')\nresult = 1 / 0\n`,
      };
    }

    return {
      analysis: `第 ${retryRound} 轮自愈：修改边界入参触发异常`,
      actionType: "MUTATE_INPUTS",
      patchedScript: previousScript + "\n# mutated input\nresult = 1 / 0\n",
    };
  }
}
