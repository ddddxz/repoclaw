import type { ParsedTraceback } from "./types.js";

/**
 * 常见可自愈修复的语法或导入异常类别
 */
const RECOVERABLE_EXCEPTIONS = new Set([
  "SyntaxError",
  "IndentationError",
  "TabError",
  "ModuleNotFoundError",
  "ImportError",
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
    RECOVERABLE_EXCEPTIONS.has(exceptionType) ||
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
