import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { IssuePayload } from "@repoclaw/shared";
import { config } from "../config.js";

export const QUEUE_NAME = "repoclaw-reproduction-queue";

let defaultRedisClient: Redis | null = null;
let defaultQueue: Queue<IssuePayload> | null = null;

export function getRedisClient(): Redis {
  if (!defaultRedisClient) {
    defaultRedisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    // 捕获连接异常以避免进程由于本地未启动 Redis 直接崩掉
    defaultRedisClient.on("error", (err) => {
      // 仅打印告警，方便开发调试
      console.warn(`[RepoClaw Redis Warning]: ${err.message}`);
    });
  }
  return defaultRedisClient;
}

export function getReproQueue(customConnection?: Redis): Queue<IssuePayload> {
  if (customConnection) {
    return new Queue<IssuePayload>(QUEUE_NAME, {
      connection: customConnection,
    });
  }

  if (!defaultQueue) {
    defaultQueue = new Queue<IssuePayload>(QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return defaultQueue;
}

/**
 * 将 ChatOps 触发的 Issue 复现任务压入异步队列
 */
export async function enqueueReproTask(
  payload: IssuePayload,
  queue?: Queue<IssuePayload>
): Promise<string> {
  const targetQueue = queue || getReproQueue();
  const job = await targetQueue.add(`repro-${payload.repoFullName}#${payload.issueNumber}`, payload, {
    jobId: payload.id,
  });
  return job.id ?? payload.id;
}
