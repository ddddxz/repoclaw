import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RepoMetadata {
  repoDir: string;
  packageNames: string[];
  pythonPathRelative: string;
  hasPyproject: boolean;
  hasSetupPy: boolean;
  entryFiles: string[];
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
    ["clone", "--depth", "1", "--single-branch", repoUrl, targetDir],
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
 * 探测目标 Python 仓库代码结构与可导入包名
 */
export async function inspectPythonRepo(repoDir: string): Promise<RepoMetadata> {
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
        // 检查目录内是否存在 __init__.py 或其它 py 文件
        const subDir = path.join(repoDir, entry.name);
        try {
          const subEntries = await fs.readdir(subDir);
          if (subEntries.some((f) => f.endsWith(".py"))) {
            packageNames.push(entry.name);
          }
        } catch {
          // 忽略
        }
      }
    }
  }

  return {
    repoDir,
    packageNames: Array.from(new Set(packageNames)),
    pythonPathRelative,
    hasPyproject,
    hasSetupPy,
    entryFiles,
  };
}
