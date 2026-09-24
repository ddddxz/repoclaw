import { parseUniversalTraceback, type ParsedTraceback } from "@repoclaw/sandbox";
import type { RepoLanguage } from "./git.js";

export interface MatchResult {
  /**
   * 是否成功确证复现了目标异常
   */
  isVerified: boolean;
  /**
   * 真实捕获到的异常类名
   */
  actualException: string;
  /**
   * 是否命中用户或计划指定的关键报错词
   */
  hasKeywordMatch: boolean;
  /**
   * 是否属于可自愈反思的导入/语法错误
   */
  isRecoverableError: boolean;
  /**
   * 判定结论与说明
   */
  reason: string;
  /**
   * 结构化堆栈
   */
  parsedTraceback: ParsedTraceback;
}

/**
 * 校验沙箱 stderr 真实报错是否与预期的 targetException 达成一致
 */
export function matchExecutionTraceback(
  targetException: string,
  errorKeywords: string[],
  actualStderr: string,
  language?: RepoLanguage
): MatchResult {
  const parsed = parseUniversalTraceback(actualStderr, language === "unknown" ? undefined : language);
  const actualException = parsed.exceptionType;

  // 1. 若没有抛出任何标准异常
  if (!actualException || actualException === "UnknownError") {
    return {
      isVerified: false,
      actualException: "None",
      hasKeywordMatch: false,
      isRecoverableError: false,
      reason: "沙箱未捕获到有效的异常堆栈",
      parsedTraceback: parsed,
    };
  }

  // 2. 检查是否为可自愈的语法或模块找不到错误
  if (parsed.isRecoverableImportOrSyntax) {
    return {
      isVerified: false,
      actualException,
      hasKeywordMatch: false,
      isRecoverableError: true,
      reason: `捕获到可自愈前置错误 (${actualException})，需要修补导入路径或语法`,
      parsedTraceback: parsed,
    };
  }

  // 3. 校验异常类名是否完全匹配 (不区分大小写与大小写敏感双重对齐)
  const isTypeMatched =
    actualException.toLowerCase() === targetException.toLowerCase() ||
    actualException.endsWith(targetException) ||
    targetException.endsWith(actualException);

  // 4. 校验关键词是否命中
  let hasKeywordMatch = true;
  if (errorKeywords.length > 0) {
    const lowerStderr = actualStderr.toLowerCase();
    hasKeywordMatch = errorKeywords.some((kw) => lowerStderr.includes(kw.toLowerCase()));
  }

  if (isTypeMatched) {
    return {
      isVerified: true,
      actualException,
      hasKeywordMatch,
      isRecoverableError: false,
      reason: `成功精准捕获目标异常 [${actualException}]，特征与预期完全吻合`,
      parsedTraceback: parsed,
    };
  }

  return {
    isVerified: false,
    actualException,
    hasKeywordMatch,
    isRecoverableError: false,
    reason: `抛出的异常 [${actualException}] 与预期的 [${targetException}] 不一致`,
    parsedTraceback: parsed,
  };
}
