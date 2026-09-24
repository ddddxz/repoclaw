import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import type { AstModuleOutline } from "@repoclaw/shared";
import { extractRepoAstOutlines } from "./ast.js";

export interface RepoMetadata {
  repoDir: string;
  packageNames: string[];
  pythonPathRelative: string;
  hasPyproject: boolean;
  hasSetupPy: boolean;
  entryFiles: string[];
  astOutlines?: AstModuleOutline[];
}

/**
 * 以 --depth 1 极速浅克隆目标仓库 HEAD (耗时通常 < 3s)
 */
export async function shallowCloneRepo(
  repoUrl: string,
  targetDir: string,
  timeoutMs = 15_000
): Promise<{ durationMs: number }> {
  const startTime = Date.now();
  await fs.mkdir(targetDir, { recursive: true });

  await execFileAsync(
    "git",
    ["clone", "--depth", "1", "--single-branch", "--", repoUrl, targetDir],
    {
      timeout: timeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    }
  );

  return { durationMs: Date.now() - startTime };
}

/**
 * 探测目标 Python 仓库代码结构与可导入包名，并静态抽取核心 AST 符号
 */
export async function inspectPythonRepo(
  repoDir: string,
  keywords?: string[]
): Promise<RepoMetadata> {
  const entries = await fs.readdir(repoDir, { withFileTypes: true });

  let hasPyproject = false;
  let hasSetupPy = false;
  const packageNames: string[] = [];
  const entryFiles: string[] = [];
  let pythonPathRelative = "/workspace";

  for (const entry of entries) {
    if (entry.isFile()) {
      if (entry.name === "pyproject.toml") hasPyproject = true;
      if (entry.name === "setup.py") hasSetupPy = true;
      if (entry.name.endsWith(".py")) {
        entryFiles.push(entry.name);
        // 单文件模块 (如 calc.py -> 模块名 calc)
        const modName = path.basename(entry.name, ".py");
        if (modName !== "setup" && modName !== "conftest") {
          packageNames.push(modName);
        }
      }
    } else if (entry.isDirectory()) {
      // 排除常见的非源码目录
      const ignored = new Set([
        ".git",
        "docs",
        "tests",
        "test",
        "venv",
        ".venv",
        "build",
        "dist",
        "__pycache__",
        "node_modules",
      ]);
      if (ignored.has(entry.name)) continue;

      // 如果有 src/ 目录，检查 src 内部的包
      if (entry.name === "src") {
        pythonPathRelative = "/workspace/src";
        try {
          const srcEntries = await fs.readdir(path.join(repoDir, "src"), { withFileTypes: true });
          for (const se of srcEntries) {
            if (se.isDirectory()) {
              packageNames.push(se.name);
            }
          }
        } catch {
          // 忽略读取错误
        }
      } else {
        // 检查目录内是否存在 __init__.py 或其它 py 文件，或子目录中包含 py 文件 (支持命名空间包/深层模块结构)
        const subDir = path.join(repoDir, entry.name);
        try {
          const subEntries = await fs.readdir(subDir, { withFileTypes: true });
          if (subEntries.some((f) => f.isFile() && f.name.endsWith(".py"))) {
            packageNames.push(entry.name);
          } else {
            // 递归/深层检查一级子目录 (如 gateway/platforms/xxx.py)
            for (const sub of subEntries) {
              if (sub.isDirectory()) {
                try {
                  const subSubEntries = await fs.readdir(path.join(subDir, sub.name));
                  if (subSubEntries.some((f) => f.endsWith(".py"))) {
                    packageNames.push(entry.name);
                    break;
                  }
                } catch {
                  // 忽略读取错误
                }
              }
            }
          }
        } catch {
          // 忽略
        }
      }
    }
  }

  // 提取核心模块的 AST 符号大纲
  let astOutlines: AstModuleOutline[] = [];
  try {
    astOutlines = await extractRepoAstOutlines(repoDir, { keywords });
  } catch {
    // 容错降级
  }

  return {
    repoDir,
    packageNames: Array.from(new Set(packageNames)),
    pythonPathRelative,
    hasPyproject,
    hasSetupPy,
    entryFiles,
    astOutlines,
  };
}

export type RepoLanguage = "python" | "typescript" | "javascript" | "unknown";

export interface UniversalRepoMetadata extends RepoMetadata {
  language: RepoLanguage;
  packageJsonData?: {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  hasTsConfig?: boolean;
  testRunner?: "vitest" | "jest" | "mocha" | "pytest" | "unknown";
}

/**
 * 自动探测目标代码仓库的主要编程语言生态 (支持 Python / TypeScript / JavaScript)
 */
export async function detectRepoLanguage(repoDir: string): Promise<RepoLanguage> {
  const entries = await fs.readdir(repoDir);
  const fileSet = new Set(entries);

  // 1. Python 特征文件探测
  if (
    fileSet.has("pyproject.toml") ||
    fileSet.has("setup.py") ||
    fileSet.has("requirements.txt") ||
    fileSet.has("Pipfile") ||
    entries.some((f) => f.endsWith(".py"))
  ) {
    return "python";
  }

  // 2. TypeScript 特征文件探测
  if (fileSet.has("tsconfig.json") || entries.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    return "typescript";
  }

  // 3. JavaScript 特征文件探测
  if (fileSet.has("package.json") || entries.some((f) => f.endsWith(".js") || f.endsWith(".jsx"))) {
    return "javascript";
  }

  return "unknown";
}

/**
 * 探测与解析 JavaScript / TypeScript 仓库环境元数据 (提取 package.json, 测试框架与核心源码)
 */
export async function inspectJsTsRepo(repoDir: string): Promise<UniversalRepoMetadata> {
  const entries = await fs.readdir(repoDir, { withFileTypes: true });
  const entryFiles: string[] = [];
  const packageNames: string[] = [];
  let hasTsConfig = false;
  let packageJsonData: any = undefined;
  let testRunner: "vitest" | "jest" | "mocha" | "pytest" | "unknown" = "unknown";

  for (const entry of entries) {
    if (entry.isFile()) {
      if (entry.name === "tsconfig.json") hasTsConfig = true;
      if (entry.name === "package.json") {
        try {
          const raw = await fs.readFile(path.join(repoDir, "package.json"), "utf8");
          packageJsonData = JSON.parse(raw);
          if (packageJsonData.name) packageNames.push(packageJsonData.name);
          const allDeps = {
            ...packageJsonData.dependencies,
            ...packageJsonData.devDependencies,
          };
          if ("vitest" in allDeps) testRunner = "vitest";
          else if ("jest" in allDeps) testRunner = "jest";
          else if ("mocha" in allDeps) testRunner = "mocha";
        } catch {
          // 容错
        }
      }
      if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".mjs") ||
        entry.name.endsWith(".cjs")
      ) {
        entryFiles.push(entry.name);
      }
    } else if (entry.isDirectory()) {
      const ignored = new Set([
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
        ".turbo",
        ".next",
      ]);
      if (ignored.has(entry.name)) continue;

      if (entry.name === "src") {
        try {
          const srcEntries = await fs.readdir(path.join(repoDir, "src"));
          for (const s of srcEntries) {
            if (s.endsWith(".ts") || s.endsWith(".js")) {
              entryFiles.push(path.join("src", s).replace(/\\/g, "/"));
            }
          }
        } catch {}
      }
    }
  }

  const isTs = hasTsConfig || entryFiles.some((f) => f.endsWith(".ts"));

  return {
    repoDir,
    language: isTs ? "typescript" : "javascript",
    packageNames: Array.from(new Set(packageNames)),
    pythonPathRelative: "/workspace",
    hasPyproject: false,
    hasSetupPy: false,
    hasTsConfig,
    packageJsonData,
    testRunner,
    entryFiles,
  };
}

/**
 * 通用多语言仓库自动识别与探测分析统一入口
 */
export async function inspectRepo(
  repoDir: string,
  keywords?: string[]
): Promise<UniversalRepoMetadata> {
  const lang = await detectRepoLanguage(repoDir);
  if (lang === "typescript" || lang === "javascript") {
    return inspectJsTsRepo(repoDir);
  }
  const pythonMeta = await inspectPythonRepo(repoDir, keywords);
  return {
    ...pythonMeta,
    language: "python",
    testRunner: "pytest",
  };
}

