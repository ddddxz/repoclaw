export * from "../schemas/repro.js";
export * from "../schemas/issue.js";

/**
 * 沙箱受限执行结果契约 (吸收自 Codex Harness 的执行结果抽象)
 */
export interface SandboxExecutionOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
}

/**
 * 复现验证最终结果
 */
export interface ReproductionResult {
  verified: boolean;
  targetExceptionFound: boolean;
  actualExceptionName?: string;
  actualTraceback?: string;
  retryCount: number;
  finalScript: string;
  logs: string[];
}
