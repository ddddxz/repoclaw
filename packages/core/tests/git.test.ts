import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inspectPythonRepo } from "../src/git.js";

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
