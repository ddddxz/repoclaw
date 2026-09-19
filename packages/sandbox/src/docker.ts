import Docker from "dockerode";
import os from "node:os";

let cachedDockerClient: Docker | null = null;

/**
 * 获取或创建跨平台适配的 Dockerode 实例
 */
export function getDockerClient(): Docker {
  if (cachedDockerClient) {
    return cachedDockerClient;
  }

  const customHost = process.env.DOCKER_HOST;
  if (customHost) {
    // 若显式指定 DOCKER_HOST (如 tcp://localhost:2375)
    const url = new URL(customHost);
    cachedDockerClient = new Docker({
      host: url.hostname,
      port: parseInt(url.port || "2375", 10),
      protocol: (url.protocol.replace(":", "") as "http" | "https") || "http",
    });
    return cachedDockerClient;
  }

  const isWindows = os.platform() === "win32";
  if (isWindows) {
    cachedDockerClient = new Docker({ socketPath: "//./pipe/docker_engine" });
  } else {
    cachedDockerClient = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  return cachedDockerClient;
}

/**
 * 快速检测当前环境 Docker 守护进程是否可用 (1500ms 超时)
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = getDockerClient();
    const pingPromise = docker.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Docker ping timeout")), 1500)
    );
    await Promise.race([pingPromise, timeoutPromise]);
    return true;
  } catch {
    return false;
  }
}
