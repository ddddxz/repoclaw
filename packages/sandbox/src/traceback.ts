import type { ParsedTraceback } from "./types.js";

/**
 * 常见可自愈修复的 Python 语法或导入异常类别
 */
const PYTHON_RECOVERABLE_EXCEPTIONS = new Set([
  "SyntaxError",
  "IndentationError",
  "TabError",
  "ModuleNotFoundError",
  "ImportError",
]);

/**
 * 常见可自愈修复的 Node.js/JavaScript 语法或导入异常类别
 */
const NODE_RECOVERABLE_EXCEPTIONS = new Set([
  "SyntaxError",
  "ERR_MODULE_NOT_FOUND",
  "MODULE_NOT_FOUND",
  "ERR_UNKNOWN_FILE_EXTENSION",
  "ReferenceError",
]);

/**
 * 从 Python 沙箱 stderr 输出中提取结构化堆栈信息 (吸收自 Codex Harness 解析算法)
 */
export function parsePythonTraceback(stderr: string): ParsedTraceback {
  const trimmed = stderr.trim();

  // 1. 正则匹配最后一行标准报错格式: ExceptionName: detailed message
  // 例如: ZeroDivisionError: division by zero
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  let exceptionType = "UnknownError";
  let exceptionMessage = "";

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? "";
    const match = line.match(/^([A-Za-z0-9_.]+(?:Error|Exception|Warning|Interrupt)):?\s*(.*)$/);
    if (match && match[1]) {
      exceptionType = match[1];
      exceptionMessage = match[2]?.trim() ?? "";
      break;
    }
  }

  // 2. 提取栈帧: File "/workspace/foo.py", line 42, in func
  const frameRegex = /File "([^"]+)", line (\d+)(?:, in (.+))?/g;
  const frames: ParsedTraceback["frames"] = [];
  let frameMatch: RegExpExecArray | null;

  while ((frameMatch = frameRegex.exec(trimmed)) !== null) {
    const file = frameMatch[1] ?? "";
    const lineStr = frameMatch[2] ?? "0";
    const line = parseInt(lineStr, 10);
    frames.push({
      file,
      line: isNaN(line) ? 0 : line,
    });
  }

  // 3. 判断是否为可由 Agent 自愈反思修补的语法/路径导入错误
  const isRecoverableImportOrSyntax =
    PYTHON_RECOVERABLE_EXCEPTIONS.has(exceptionType) ||
    trimmed.includes("ModuleNotFoundError: No module named") ||
    trimmed.includes("SyntaxError: invalid syntax");

  return {
    exceptionType,
    exceptionMessage,
    isRecoverableImportOrSyntax,
    frames,
    rawStderr: stderr,
  };
}

/**
 * 从 Node.js/V8 引擎 stderr 输出中提取结构化堆栈信息 (适配 JS/TS 仓库，如 deepseek-harness)
 */
export function parseNodeTraceback(stderr: string): ParsedTraceback {
  const trimmed = stderr.trim();
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let exceptionType = "UnknownError";
  let exceptionMessage = "";

  // 1. 查找首个匹配 Error 行: e.g. TypeError: Cannot read properties of undefined...
  for (const line of lines) {
    const trimmedLine = line.trim();
    // 匹配如 "TypeError: ...", "Error [ERR_MODULE_NOT_FOUND]: ...", "AssertionError: ..."
    const match = trimmedLine.match(
      /^(?:(?:\w+)?\s*\[([A-Z0-9_]+)\]\s*:?|([A-Za-z0-9_]+Error|Exception)):?\s*(.*)$/
    );
    if (match) {
      exceptionType = match[2] || match[1] || "Error";
      exceptionMessage = (match[3] ?? "").trim();
      break;
    }
  }

  // 2. 提取 V8 调用栈帧: at Function.run (/workspace/src/index.js:42:15)
  const frameRegex = /at (?:(.+?)\s+\()?(?:file:\/\/)?([^:)]+):(\d+)(?::\d+)?\)?/g;
  const frames: ParsedTraceback["frames"] = [];
  let frameMatch: RegExpExecArray | null;

  while ((frameMatch = frameRegex.exec(trimmed)) !== null) {
    const file = frameMatch[2] ?? "";
    const lineStr = frameMatch[3] ?? "0";
    const line = parseInt(lineStr, 10);
    frames.push({
      file,
      line: isNaN(line) ? 0 : line,
    });
  }

  // 3. 识别可由 Agent 自愈反思修补的模块缺失或语法错误
  const isRecoverableImportOrSyntax =
    NODE_RECOVERABLE_EXCEPTIONS.has(exceptionType) ||
    trimmed.includes("ERR_MODULE_NOT_FOUND") ||
    trimmed.includes("Cannot find module") ||
    trimmed.includes("Unexpected token") ||
    trimmed.includes("ERR_UNKNOWN_FILE_EXTENSION");

  return {
    exceptionType,
    exceptionMessage,
    isRecoverableImportOrSyntax,
    frames,
    rawStderr: stderr,
  };
}

/**
 * 通用多语言堆栈解析器调度入口
 */
export function parseUniversalTraceback(
  stderr: string,
  lang?: "python" | "typescript" | "javascript"
): ParsedTraceback {
  if (lang === "typescript" || lang === "javascript") {
    return parseNodeTraceback(stderr);
  }
  if (lang === "python") {
    return parsePythonTraceback(stderr);
  }

  // 自动启发式探测
  if (stderr.includes("Traceback (most recent call last):")) {
    return parsePythonTraceback(stderr);
  }
  if (
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|ERR_MODULE_NOT_FOUND|at\s+.*:\d+:\d+)\b/.test(
      stderr
    )
  ) {
    return parseNodeTraceback(stderr);
  }

  return parsePythonTraceback(stderr);
}
