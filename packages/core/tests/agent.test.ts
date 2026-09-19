import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { MockSandboxRunner } from "@repoclaw/sandbox";
import { ReproAgent } from "../src/agent.js";
import { MockLlmProvider } from "../src/llm.js";

describe("@repoclaw/core ReproAgent 状态机自愈反思闭环与基准测试", () => {
  it("场景 1: 首轮直接命中目标异常 (Round 0 Verified)", async () => {
    const tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-agent-test1-"));

    try {
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "ZeroDivisionError",
          errorKeywords: ["division by zero"],
          reproScript: "import sys\nresult = 1 / 0\n",
          explanation: "直接触发 ZeroDivisionError 报错",
        }),
      });

      const sandbox = new MockSandboxRunner();

      const agent = new ReproAgent({
        repoDir: tempRepo,
        issueTitle: "Zero division in math.py",
        issueBody: "Calling divide(1, 0) raises ZeroDivisionError",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();

      expect(result.status).toBe("VERIFIED");
      expect(result.retryCount).toBe(0);
      expect(result.targetException).toBe("ZeroDivisionError");
      expect(result.markdownReport).toContain("RepoClaw 自动化 Bug 复现报告 (Verified)");
      expect(result.markdownReport).toContain("ZeroDivisionError");
    } finally {
      await fs.rm(tempRepo, { recursive: true, force: true });
    }
  });

  it("场景 2: 触发自愈反思闭环并在第二轮成功复现 (Reflection Loop Success)", async () => {
    const tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-agent-test2-"));

    try {
      let runCount = 0;

      // 模拟第一轮沙箱返回 ModuleNotFoundError，第二轮修正后抛出 ZeroDivisionError
      const sandbox = new MockSandboxRunner(() => {
        runCount++;
        if (runCount === 1) {
          return {
            exitCode: 1,
            stderr: "Traceback (most recent call last):\n  File 'repro.py', line 1\nModuleNotFoundError: No module named 'math_pkg'",
          };
        }
        return {
          exitCode: 1,
          stderr: "Traceback (most recent call last):\n  File 'repro.py', line 3\nZeroDivisionError: division by zero",
        };
      });

      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "ZeroDivisionError",
          errorKeywords: ["division by zero"],
          reproScript: "import math_pkg\nmath_pkg.calc()",
          explanation: "调用 math_pkg.calc 触发除以零异常",
        }),
        customReflection: (_stderr, round) => ({
          analysis: `第 ${round} 轮反思：路径错误，已补全 sys.path`,
          actionType: "PATCH_IMPORTS",
          patchedScript: "import sys\nsys.path.insert(0, '/workspace')\nresult = 1 / 0\n",
        }),
      });

      const agent = new ReproAgent({
        repoDir: tempRepo,
        issueTitle: "Divide by zero issue",
        issueBody: "Throws ZeroDivisionError",
        maxRetries: 3,
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();

      expect(result.status).toBe("VERIFIED");
      expect(result.retryCount).toBe(1); // 经过 1 轮自愈反思修补后成功
      expect(result.markdownReport).toContain("**自愈重试轮数**: 1 轮");
    } finally {
      await fs.rm(tempRepo, { recursive: true, force: true });
    }
  });

  it("场景 3: 持续语法错误超出最大 3 轮限制 (Exceed Max Retries -> FAILED)", async () => {
    const tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-agent-test3-"));

    try {
      const sandbox = new MockSandboxRunner(() => ({
        exitCode: 1,
        stderr: "SyntaxError: invalid syntax",
      }));

      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "ValueError",
          errorKeywords: ["invalid"],
          reproScript: "def invalid(",
          explanation: "测试语法错误熔断",
        }),
      });

      const agent = new ReproAgent({
        repoDir: tempRepo,
        issueTitle: "Syntax test",
        issueBody: "Broken code",
        maxRetries: 2,
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();

      expect(result.status).toBe("FAILED");
      expect(result.retryCount).toBe(2);
      expect(result.markdownReport).toContain("未能复现出目标报错");
    } finally {
      await fs.rm(tempRepo, { recursive: true, force: true });
    }
  });

  it("场景 4: 脚本正常退出未引发报错 (Exit 0 -> UNVERIFIED)", async () => {
    const tempRepo = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-agent-test4-"));

    try {
      const sandbox = new MockSandboxRunner(() => ({
        exitCode: 0,
        stdout: "Processed cleanly",
        stderr: "",
      }));

      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "KeyError",
          errorKeywords: ["missing key"],
          reproScript: "data = {'a': 1}\nprint(data.get('a'))",
          explanation: "查询数据",
        }),
      });

      const agent = new ReproAgent({
        repoDir: tempRepo,
        issueTitle: "Missing key error",
        issueBody: "Should throw KeyError when key is missing",
        maxRetries: 1,
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();

      expect(result.status).toBe("UNVERIFIED");
      expect(result.markdownReport).toContain("RepoClaw 复现尝试反馈 (Clarification Needed)");
      expect(result.markdownReport).toContain("未能复现出目标报错");
    } finally {
      await fs.rm(tempRepo, { recursive: true, force: true });
    }
  });
});
