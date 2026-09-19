import { z } from "zod";

/**
 * 大模型生成的最小复现计划模型
 */
export const ReproPlanSchema = z.object({
  targetException: z
    .string()
    .min(1)
    .describe("预期的核心报错类型，如 ZeroDivisionError, ValueError, KeyError"),
  errorKeywords: z
    .array(z.string())
    .default([])
    .describe("预期堆栈中必须包含的关键词列表"),
  reproScript: z
    .string()
    .min(1)
    .describe("完整的、可独立运行的 Python 复现脚本代码（使用标准库或目标仓库自身模块）"),
  explanation: z
    .string()
    .describe("该复现脚本的构造原理与触发意图简要说明"),
});

export type ReproPlan = z.infer<typeof ReproPlanSchema>;

/**
 * 自愈反思与修复模型
 */
export const ReflectionSchema = z.object({
  analysis: z
    .string()
    .describe("分析为何上一轮脚本未成功触发目标 Bug（如：模块路径错误、入参未达到边界条件）"),
  actionType: z
    .enum(["PATCH_IMPORTS", "MUTATE_INPUTS", "ABORT"])
    .describe("采取的修复动作类别"),
  patchedScript: z
    .string()
    .describe("修复后的最新完整复现脚本"),
});

export type Reflection = z.infer<typeof ReflectionSchema>;
