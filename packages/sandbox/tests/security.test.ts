import { describe, it, expect } from "vitest";
import {
  buildSecureContainerConfig,
  validateSandboxSecurity,
  parsePythonTraceback,
  MockSandboxRunner,
  createSandboxRunner,
} from "../src/index.js";

describe("@repoclaw/sandbox 沙箱隔离器与安全性基线测试", () => {
  describe("1. 安全基线配置与防逃逸策略校验 (Security Policy Checks)", () => {
    it("应正确构建带有严格 cgroups 和断网隔离的容器配置", () => {
      const config = buildSecureContainerConfig({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "print('hello')",
      });

      expect(config.HostConfig?.NetworkMode).toBe("none");
      expect(config.HostConfig?.ReadonlyRootfs).toBe(true);
      expect(config.User).toBe("1000:1000");
      expect(config.HostConfig?.Memory).toBe(512 * 1024 * 1024);
      expect(config.HostConfig?.PidsLimit).toBe(64);
      expect(config.HostConfig?.Tmpfs).toBeDefined();
      expect(config.HostConfig?.Binds).toContain("C:/fake/repo:/workspace:ro");

      // 应当顺利通过安全审计校验
      expect(() => validateSandboxSecurity(config)).not.toThrow();
    });

    it("当检测到网络模式非 none 时，安全校验必须强行阻断并报错", () => {
      const dangerousConfig = buildSecureContainerConfig({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "print('danger')",
      });

      if (dangerousConfig.HostConfig) {
        dangerousConfig.HostConfig.NetworkMode = "bridge"; // 模拟篡改网络
      }

      expect(() => validateSandboxSecurity(dangerousConfig)).toThrow(/NetworkMode 必须为 none/);
    });

    it("当尝试使用 root 用户运行时，安全校验必须强行拦截", () => {
      const rootConfig = buildSecureContainerConfig({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "print('root')",
      });

      rootConfig.User = "0:0"; // 模拟试图提权

      expect(() => validateSandboxSecurity(rootConfig)).toThrow(/User 必须降权为非 root/);
    });
  });

  describe("2. Python Traceback 堆栈精准抽取 (Codex Harness 栈帧算法测试)", () => {
    it("应从复杂 Traceback 中精确提取异常类型、消息以及出错行号", () => {
      const stderr = `
Traceback (most recent call last):
  File "/workspace/math_utils.py", line 42, in safe_divide
    return numerator / denominator
ZeroDivisionError: division by zero
      `.trim();

      const parsed = parsePythonTraceback(stderr);
      expect(parsed.exceptionType).toBe("ZeroDivisionError");
      expect(parsed.exceptionMessage).toBe("division by zero");
      expect(parsed.isRecoverableImportOrSyntax).toBe(false);
      expect(parsed.frames.length).toBe(1);
      expect(parsed.frames[0]?.file).toBe("/workspace/math_utils.py");
      expect(parsed.frames[0]?.line).toBe(42);
    });

    it("应正确识别 ModuleNotFoundError 为可自愈反思异常", () => {
      const stderr = `
Traceback (most recent call last):
  File "/scratch/repro.py", line 3, in <module>
    import non_existent_library
ModuleNotFoundError: No module named 'non_existent_library'
      `.trim();

      const parsed = parsePythonTraceback(stderr);
      expect(parsed.exceptionType).toBe("ModuleNotFoundError");
      expect(parsed.isRecoverableImportOrSyntax).toBe(true);
    });

    it("应正确识别 SyntaxError 为可自愈反思异常", () => {
      const stderr = `
  File "/scratch/repro.py", line 5
    def invalid syntax
                    ^
SyntaxError: invalid syntax
      `.trim();

      const parsed = parsePythonTraceback(stderr);
      expect(parsed.exceptionType).toBe("SyntaxError");
      expect(parsed.isRecoverableImportOrSyntax).toBe(true);
    });
  });

  describe("3. 沙箱隔离运行生命周期与熔断回收测试 (Lifecycle & Timeout Kill)", () => {
    it("测试用例 1: 执行死循环脚本，验证超时熔断并强杀 (SIGKILL 137)", async () => {
      const runner = new MockSandboxRunner();
      const result = await runner.run({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "while True:\n    pass",
        timeoutMs: 1000,
      });

      expect(result.timedOut).toBe(true);
      expect(result.killed).toBe(true);
      expect(result.exitCode).toBe(137);
      expect(result.stderr).toContain("Execution timed out");
    });

    it("测试用例 2: 执行外部网络请求，验证被安全隔离拦截", async () => {
      const runner = new MockSandboxRunner();
      const result = await runner.run({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "import urllib.request\nurllib.request.urlopen('https://github.com')",
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("URLError");
      expect(result.timedOut).toBe(false);
    });

    it("测试用例 3: 真实异常捕获与结构化输出", async () => {
      const runner = new MockSandboxRunner();
      const result = await runner.run({
        hostRepoDir: "C:/fake/repo",
        scriptContent: "result = 1 / 0  # ZeroDivisionError",
      });

      expect(result.exitCode).toBe(1);
      const parsed = parsePythonTraceback(result.stderr);
      expect(parsed.exceptionType).toBe("ZeroDivisionError");
    });

    it("沙箱工厂应能自动感应环境并提供可用 Runner", async () => {
      const runner = await createSandboxRunner();
      expect(runner).toBeDefined();
      const isReady = await runner.isAvailable();
      expect(typeof isReady).toBe("boolean");
    });
  });
});
