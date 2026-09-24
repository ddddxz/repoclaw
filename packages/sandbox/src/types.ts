import type { SandboxExecutionOutput } from "@repoclaw/shared";

/**
 * 沙箱受限容器启动参数
 */
export interface SandboxOptions {
  /**
   * 宿主机目标仓库本地路径 (将被只读挂载至 /workspace)
   */
  hostRepoDir: string;
  /**
   * 待执行的 Python 复现脚本源码
   */
  scriptContent: string;
  /**
   * 硬性超时时间 (毫秒)，默认 30,000ms (30s)
   */
  timeoutMs?: number;
  /**
   * 容器内存上限 (字节)，默认 512MB
   */
  memoryBytes?: number;
  /**
   * 基础镜像名称，默认 python:3.11-slim
   */
  imageName?: string;
  /**
   * 环境变量注入
   */
  env?: Record<string, string>;
  /**
   * 目标语言生态 (python | typescript | javascript)，默认 python
   */
  language?: "python" | "typescript" | "javascript";
  /**
   * 自定义注入的复现脚本文件名 (如 repro.mjs 或 repro.py)
   */
  scriptFileName?: string;
  /**
   * 额外只读数据/依赖卷挂载 (例如大工程预置的依赖缓存 site-packages 或 node_modules)
   */
  extraBinds?: string[];
}

/**
 * 结构化解析后的 Python / Node.js 堆栈信息 (吸收自 Codex Harness 与 SWE-bench)
 */
export interface ParsedTraceback {
  /**
   * 异常类型名称 (如 ZeroDivisionError, KeyError, ModuleNotFoundError, TypeError)
   */
  exceptionType: string;
  /**
   * 异常具体描述信息
   */
  exceptionMessage: string;
  /**
   * 是否由语法或模块缺失引起 (属于可自愈反思范畴)
   */
  isRecoverableImportOrSyntax: boolean;
  /**
   * 触发异常的关键源文件行与文件路径
   */
  frames: Array<{
    file: string;
    line: number;
    codeSnippet?: string;
    /**
     * 是否属于当前被测工程内部代码帧 (区分第三方包与底层环境)
     */
    isWorkspaceFrame?: boolean;
  }>;
  /**
   * 原始完整 stderr 文本
   */
  rawStderr: string;
}

/**
 * 沙箱执行器接口契约
 */
export interface ISandboxRunner {
  /**
   * 执行复现脚本并捕获隔离输出
   */
  run(options: SandboxOptions): Promise<SandboxExecutionOutput>;
  /**
   * 检查底层驱动是否就绪
   */
  isAvailable(): Promise<boolean>;
}
