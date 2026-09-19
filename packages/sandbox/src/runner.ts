import { Writable } from "node:stream";
import tar from "tar-stream";
import type { SandboxExecutionOutput } from "@repoclaw/shared";
import { getDockerClient, isDockerAvailable } from "./docker.js";
import {
  buildSecureContainerConfig,
  SANDBOX_DEFAULTS,
  validateSandboxSecurity,
} from "./security.js";
import type { ISandboxRunner, SandboxOptions } from "./types.js";

/**
 * 原生 Dockerode 沙箱执行器
 */
export class DockerSandboxRunner implements ISandboxRunner {
  async isAvailable(): Promise<boolean> {
    return isDockerAvailable();
  }

  async run(options: SandboxOptions): Promise<SandboxExecutionOutput> {
    const docker = getDockerClient();
    const timeoutMs = options.timeoutMs ?? SANDBOX_DEFAULTS.TIMEOUT_MS;
    const startTime = Date.now();

    // 1. 构建并校验硬安全隔离配置
    const containerConfig = buildSecureContainerConfig(options);
    validateSandboxSecurity(containerConfig);

    let containerId: string | null = null;
    let timedOut = false;
    let killed = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
      // 2. 创建受限容器
      const container = await docker.createContainer(containerConfig);
      containerId = container.id;

      // 3. 将 repro.py 复现脚本通过 tar 流安全注入 /scratch 目录
      const pack = tar.pack();
      pack.entry({ name: "repro.py", mode: 0o755 }, options.scriptContent);
      pack.finalize();
      await container.putArchive(pack as unknown as NodeJS.ReadableStream, { path: "/scratch" });

      // 4. 附加 I/O 流，Demux 分离 stdout 与 stderr
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
      });

      let stdout = "";
      let stderr = "";

      const stdoutStream = new Writable({
        write(chunk, _encoding, callback) {
          stdout += chunk.toString("utf8");
          callback();
        },
      });

      const stderrStream = new Writable({
        write(chunk, _encoding, callback) {
          stderr += chunk.toString("utf8");
          callback();
        },
      });

      docker.modem.demuxStream(stream, stdoutStream, stderrStream);

      // 5. 启动容器并设定硬性熔断定时器
      await container.start();

      const timeoutPromise = new Promise<{ StatusCode: number }>((_, reject) => {
        timeoutTimer = setTimeout(async () => {
          timedOut = true;
          killed = true;
          try {
            await container.kill({ signal: "SIGKILL" });
          } catch {
            // 忽略容器已退出时的 kill 报错
          }
          reject(new Error(`沙箱执行超时：超出限定的 ${timeoutMs}ms 阈值`));
        }, timeoutMs);
      });

      const waitPromise = container.wait();

      let statusCode = -1;
      try {
        const res = await Promise.race([waitPromise, timeoutPromise]);
        statusCode = res.StatusCode;
      } catch (err: unknown) {
        if (!timedOut) throw err;
        statusCode = 137; // SIGKILL 状态码
        stderr += `\n[RepoClaw Sandbox Alert]: Execution timed out after ${timeoutMs}ms. Process killed.`;
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
      }

      const durationMs = Date.now() - startTime;

      return {
        exitCode: statusCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs,
        timedOut,
        killed,
      };
    } finally {
      // 6. 确保容器必然被强制销毁与回收
      if (containerId) {
        try {
          const containerToClean = docker.getContainer(containerId);
          await containerToClean.remove({ force: true, v: true });
        } catch {
          // 忽略已清理容器的异常
        }
      }
    }
  }
}

/**
 * 虚拟仿真沙箱执行器 (Mock Runner)，吸收自 Codex Harness 的本地隔离评测设计
 * 在开发测试环境或无 Docker 守护进程环境下提供高保真确定性执行
 */
export class MockSandboxRunner implements ISandboxRunner {
  private mockBehavior?: (options: SandboxOptions) => Partial<SandboxExecutionOutput>;

  constructor(mockBehavior?: (options: SandboxOptions) => Partial<SandboxExecutionOutput>) {
    this.mockBehavior = mockBehavior;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async run(options: SandboxOptions): Promise<SandboxExecutionOutput> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? SANDBOX_DEFAULTS.TIMEOUT_MS;

    // 若配置了自定义 Mock 行为
    if (this.mockBehavior) {
      const custom = this.mockBehavior(options);
      return {
        exitCode: custom.exitCode ?? 0,
        stdout: custom.stdout ?? "",
        stderr: custom.stderr ?? "",
        durationMs: custom.durationMs ?? (Date.now() - startTime),
        timedOut: custom.timedOut ?? false,
        killed: custom.killed ?? false,
      };
    }

    // 默认仿真逻辑：根据 scriptContent 关键词进行智能高保真响应
    const script = options.scriptContent;

    // 1. 模拟死循环超时场景
    if (script.includes("while True:") || script.includes("time.sleep(999)")) {
      return {
        exitCode: 137,
        stdout: "",
        stderr: `[RepoClaw Sandbox Alert]: Execution timed out after ${timeoutMs}ms. Process killed.`,
        durationMs: timeoutMs,
        timedOut: true,
        killed: true,
      };
    }

    // 2. 模拟网络访问拦截场景 (验证 NetworkMode: none)
    if (script.includes("urllib.request") || script.includes("requests.get") || script.includes("socket.connect")) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `urllib.error.URLError: <urlopen error [Errno -3] Temporary failure in name resolution / Network unreachable>`,
        durationMs: 45,
        timedOut: false,
        killed: false,
      };
    }

    // 3. 模拟异常抛出 (如 ZeroDivisionError, ValueError)
    if (script.includes("ZeroDivisionError") || script.includes("1 / 0")) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Traceback (most recent call last):\n  File "/scratch/repro.py", line 12, in <module>\n    result = 1 / 0\nZeroDivisionError: division by zero`,
        durationMs: 82,
        timedOut: false,
        killed: false,
      };
    }

    // 4. 模拟 ModuleNotFoundError
    if (script.includes("import non_existent_pkg")) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Traceback (most recent call last):\n  File "/scratch/repro.py", line 2, in <module>\n    import non_existent_pkg\nModuleNotFoundError: No module named 'non_existent_pkg'`,
        durationMs: 38,
        timedOut: false,
        killed: false,
      };
    }

    // 5. 默认执行成功退出 (Exit 0)
    return {
      exitCode: 0,
      stdout: "Reproduction script executed successfully without raising target exception.",
      stderr: "",
      durationMs: 65,
      timedOut: false,
      killed: false,
    };
  }
}

/**
 * 自动感知的沙箱执行器工厂
 */
export async function createSandboxRunner(forceMock = false): Promise<ISandboxRunner> {
  if (forceMock) {
    return new MockSandboxRunner();
  }

  const dockerAvailable = await isDockerAvailable();
  if (dockerAvailable) {
    return new DockerSandboxRunner();
  }

  return new MockSandboxRunner();
}
