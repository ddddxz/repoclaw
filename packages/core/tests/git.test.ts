import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  inspectPythonRepo,
  detectRepoLanguage,
  inspectJsTsRepo,
  inspectRepo,
} from "../src/git.js";

describe("@repoclaw/core Python 仓库结构探测测试", () => {
  it("应准确识别根目录下的 pyproject.toml 与包目录", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-test-repo-"));

    try {
      // 构造模拟 Python 仓库
      await fs.writeFile(path.join(tempDir, "pyproject.toml"), "[project]\nname='mypkg'");
      await fs.writeFile(path.join(tempDir, "calc.py"), "def add(a, b): return a + b");

      const pkgDir = path.join(tempDir, "my_package");
      await fs.mkdir(pkgDir);
      await fs.writeFile(path.join(pkgDir, "__init__.py"), "");

      const meta = await inspectPythonRepo(tempDir);
      expect(meta.hasPyproject).toBe(true);
      expect(meta.hasSetupPy).toBe(false);
      expect(meta.packageNames).toContain("calc");
      expect(meta.packageNames).toContain("my_package");
      expect(meta.entryFiles).toContain("calc.py");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("当存在 src/ 目录时，应将 pythonPathRelative 指向 /workspace/src", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-test-src-"));

    try {
      const srcDir = path.join(tempDir, "src", "deep_pkg");
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, "__init__.py"), "");

      const meta = await inspectPythonRepo(tempDir);
      expect(meta.pythonPathRelative).toBe("/workspace/src");
      expect(meta.packageNames).toContain("deep_pkg");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("@repoclaw/core 多语言仓库探测与分析测试 (JS/TS/Universal)", () => {
  it("应准确识别仓库主语言类型 (Python / TS / JS / Unknown)", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-lang-test-"));

    try {
      // 默认空目录
      expect(await detectRepoLanguage(tempDir)).toBe("unknown");

      // 添加 package.json
      await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify({ name: "demo" }));
      expect(await detectRepoLanguage(tempDir)).toBe("javascript");

      // 添加 tsconfig.json
      await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");
      expect(await detectRepoLanguage(tempDir)).toBe("typescript");

      // 添加 Python 标识
      await fs.writeFile(path.join(tempDir, "pyproject.toml"), "");
      expect(await detectRepoLanguage(tempDir)).toBe("python");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("应准确提取 TypeScript 仓库元数据及 Vitest 测试框架", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-ts-test-"));

    try {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "@org/sample-app",
          devDependencies: { vitest: "^1.5.0", typescript: "^5.0.0" },
        })
      );
      await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");
      const srcDir = path.join(tempDir, "src");
      await fs.mkdir(srcDir);
      await fs.writeFile(path.join(srcDir, "index.ts"), "export const hello = 'world';");

      const meta = await inspectJsTsRepo(tempDir);
      expect(meta.language).toBe("typescript");
      expect(meta.hasTsConfig).toBe(true);
      expect(meta.packageNames).toContain("@org/sample-app");
      expect(meta.testRunner).toBe("vitest");
      expect(meta.entryFiles).toContain("src/index.ts");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("应通过 inspectRepo 统一入口自适应分发 Python 与 JS/TS 仓库", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-uni-test-"));

    try {
      // JS 仓库
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "js-lib",
          devDependencies: { jest: "^29.0.0" },
        })
      );
      await fs.writeFile(path.join(tempDir, "index.js"), "module.exports = {};");

      const jsMeta = await inspectRepo(tempDir);
      expect(jsMeta.language).toBe("javascript");
      expect(jsMeta.testRunner).toBe("jest");
      expect(jsMeta.entryFiles).toContain("index.js");

      // 清空并切换为 Python 仓库
      await fs.rm(path.join(tempDir, "package.json"));
      await fs.rm(path.join(tempDir, "index.js"));
      await fs.writeFile(path.join(tempDir, "requirements.txt"), "pytest>=7.0.0");
      await fs.writeFile(path.join(tempDir, "app.py"), "print('hi')");

      const pyMeta = await inspectRepo(tempDir);
      expect(pyMeta.language).toBe("python");
      expect(pyMeta.testRunner).toBe("pytest");
      expect(pyMeta.entryFiles).toContain("app.py");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
