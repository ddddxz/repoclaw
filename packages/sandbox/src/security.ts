import type Docker from "dockerode";
import type { SandboxOptions } from "./types.js";

/**
 * 默认沙箱安全常量定义 (与 docs/TECH_SPEC.md 第 4 节及 docs/architecture.md 第 5 节严格一致)
 */
export const SANDBOX_DEFAULTS = {
  IMAGE: "python:3.11-slim",
  NODE_IMAGE: "node:20-slim",
  TIMEOUT_MS: 30_000,                  // 30 秒硬超时熔断
  MEMORY_BYTES: 512 * 1024 * 1024,      // 512MB 内存上限
  NANO_CPUS: 1_000_000_000,             // 1.0 个 CPU 核心
  PIDS_LIMIT: 64,                       // 防御 Fork 炸弹耗尽宿主机进程表
  USER: "1000:1000",                    // 降权执行用户 (非 root)
  WORKING_DIR: "/scratch",
  REPRO_FILE_PATH: "/scratch/repro.py",
  NODE_REPRO_FILE_PATH: "/scratch/repro.mjs",
} as const;

/**
 * 构建符合严格防逃逸规范的 Dockerode 容器创建配置
 */
export function buildSecureContainerConfig(options: SandboxOptions): Docker.ContainerCreateOptions {
  const memory = options.memoryBytes ?? SANDBOX_DEFAULTS.MEMORY_BYTES;
  const isNode = options.language === "typescript" || options.language === "javascript";
  const defaultImage = isNode ? SANDBOX_DEFAULTS.NODE_IMAGE : SANDBOX_DEFAULTS.IMAGE;
  const image = options.imageName ?? defaultImage;

  const scriptFileName = options.scriptFileName ?? (isNode ? "repro.mjs" : "repro.py");
  const reproFilePath = `${SANDBOX_DEFAULTS.WORKING_DIR}/${scriptFileName}`;

  // 将环境变量转化为 KEY=VALUE 格式
  const envArray: string[] = isNode
    ? ["NODE_ENV=test", "NODE_PATH=/workspace/node_modules:/workspace"]
    : [
        "PYTHONUNBUFFERED=1",
        "PYTHONDONTWRITEBYTECODE=1",
        "PYTHONPATH=/workspace",
      ];
  if (options.env) {
    for (const [k, v] of Object.entries(options.env)) {
      envArray.push(`${k}=${v}`);
    }
  }

  // 校验必须提供合规的挂载目录
  if (!options.hostRepoDir) {
    throw new Error("沙箱启动失败：未指定有效的 hostRepoDir 仓库挂载路径");
  }

  const cmd = isNode ? ["node", reproFilePath] : ["python", reproFilePath];

  return {
    Image: image,
    Tty: false,
    OpenStdin: false,
    User: SANDBOX_DEFAULTS.USER,
    WorkingDir: SANDBOX_DEFAULTS.WORKING_DIR,
    Cmd: cmd,
    Env: envArray,
    HostConfig: {
      // 1. 网络绝对断网，杜绝反弹 Shell、对外探测与挖矿
      NetworkMode: "none",

      // 2. 严格的 cgroups 资源限制
      Memory: memory,
      MemorySwap: memory, // 禁止使用 Swap，防内存击穿
      NanoCpus: SANDBOX_DEFAULTS.NANO_CPUS,
      PidsLimit: SANDBOX_DEFAULTS.PIDS_LIMIT,

      // 3. 根文件系统只读挂载
      ReadonlyRootfs: true,

      // 4. 挂载 64MB 临时内存盘供脚本写入与执行
      Tmpfs: {
        "/tmp": "rw,noexec,nosuid,size=64m",
        "/scratch": "rw,exec,nosuid,size=64m",
      },

      // 5. 目标仓库代码目录以只读挂载 (支持大工程外部缓存依赖卷挂载)
      Binds: (() => {
        const binds = [`${options.hostRepoDir}:/workspace:ro`];
        if (options.extraBinds) {
          for (const b of options.extraBinds) {
            const bindStr = b.endsWith(":ro") ? b : `${b}:ro`;
            binds.push(bindStr);
          }
        }
        return binds;
      })(),

      // 6. 安全配置扩展：禁止特权模式与提权
      Privileged: false,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges:true"],
    },
  };
}

/**
 * 校验沙箱配置是否符合安全基线
 */
export function validateSandboxSecurity(config: Docker.ContainerCreateOptions): void {
  const hostConfig = config.HostConfig;
  if (!hostConfig) {
    throw new Error("安全校验失败：缺少 HostConfig");
  }

  if (hostConfig.NetworkMode !== "none") {
    throw new Error(`安全违规：NetworkMode 必须为 none，实际为 ${hostConfig.NetworkMode}`);
  }

  if (!hostConfig.ReadonlyRootfs) {
    throw new Error("安全违规：ReadonlyRootfs 必须为 true");
  }

  if (config.User !== SANDBOX_DEFAULTS.USER && config.User !== "1000:1000") {
    throw new Error(`安全违规：User 必须降权为非 root，实际为 ${config.User}`);
  }

  if (hostConfig.Privileged) {
    throw new Error("安全违规：禁止启用 Privileged 特权模式");
  }

  if (!hostConfig.PidsLimit || hostConfig.PidsLimit > 128) {
    throw new Error(`安全违规：必须配置严格的 PidsLimit (<= 128)，实际为 ${hostConfig.PidsLimit}`);
  }
}
