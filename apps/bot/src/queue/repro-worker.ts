import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProbotOctokit } from "probot";
import {
  ReproAgent,
  VercelAILlmProvider,
  shallowCloneRepo,
  type ILLMProvider,
} from "@repoclaw/core";
import {
  createSandboxRunner,
  type ISandboxRunner,
} from "@repoclaw/sandbox";
import type { IssuePayload } from "@repoclaw/shared";
import { config } from "../config.js";
import { QUEUE_NAME, getRedisClient } from "./repro-queue.js";
import { getDatabase, type ReproTaskRepository } from "../db/index.js";

export type OctokitClient = InstanceType<typeof ProbotOctokit>;

export interface WorkerDependencies {
  octokit?: OctokitClient;
  llmProvider?: ILLMProvider;
  sandboxRunner?: ISandboxRunner;
  db?: ReproTaskRepository;
}

/**
 * 核心复现任务执行器逻辑 (包含状态机审计落盘)
 */
export async function processReproJob(
  job: Job<IssuePayload>,
  deps?: WorkerDependencies
): Promise<{ status: string; verified: boolean; durationMs: number }> {
  const payload = job.data;
  const taskId = payload.id;
  const [owner, repo] = payload.repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`非法仓库名: ${payload.repoFullName}`);
  }

  const db = deps?.db || (await getDatabase().catch(() => null));

  // 1. 更新任务状态为 RUNNING 并记录克隆审计
  if (db) {
    await db.updateTask(taskId, {
      status: "RUNNING",
      step: "CLONING",
    }).catch(() => {});
    await db.recordAuditLog(taskId, "CLONING", `开始浅克隆仓库 ${payload.repoFullName}`, {
      cloneUrl: payload.repoCloneUrl,
    }).catch(() => {});
  }

  const tempRepoDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `repoclaw-${owner}-${repo}-${payload.issueNumber}-`)
  );

  try {
    // 2. 极速浅克隆目标仓库
    await shallowCloneRepo(payload.repoCloneUrl, tempRepoDir);

    // 3. 初始化核心 Agent 与沙箱
    const llmProvider = deps?.llmProvider || new VercelAILlmProvider({
      modelName: config.modelName,
      apiKey: config.deepseekApiKey,
    });
    const sandboxRunner = deps?.sandboxRunner || (await createSandboxRunner());

    const agent = new ReproAgent({
      repoDir: tempRepoDir,
      issueTitle: payload.issueTitle,
      issueBody: payload.issueBody,
      maxRetries: config.maxRetries,
      sandboxTimeoutMs: config.sandboxTimeoutMs,
      llmProvider,
      sandboxRunner,
      onStepChange: async (step, detail) => {
        job.updateProgress({ step, detail });
        if (db) {
          await db.updateTask(taskId, { step }).catch(() => {});
          await db.recordAuditLog(taskId, step, detail || step).catch(() => {});
        }
      },
    });

    // 4. 执行状态机自愈反思闭环
    const result = await agent.execute();

    const isVerified = result.status === "VERIFIED";
    const finalTaskStatus = isVerified ? "VERIFIED" : "UNVERIFIED";

    // 5. 回写 GitHub: 发帖、打标、更新 Reaction 表情
    if (deps?.octokit) {
      const octokit = deps.octokit;

      if (db) {
        await db.recordAuditLog(taskId, "GITHUB_NOTIFY", "开始回写 GitHub 评论与标签");
      }

      // 5.1 回复结构化 Markdown 报告
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: payload.issueNumber,
        body: result.markdownReport,
      });

      // 5.2 若复现成功，打上 [reproduced] 标签并贴 🚀
      if (isVerified) {
        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: payload.issueNumber,
          labels: ["reproduced"],
        });

        await octokit.reactions.createForIssueComment({
          owner,
          repo,
          comment_id: payload.commentId,
          content: "rocket",
        });
      } else {
        // 未能复现，更新反应为 😕
        await octokit.reactions.createForIssueComment({
          owner,
          repo,
          comment_id: payload.commentId,
          content: "confused",
        });
      }
    }

    // 6. 审计持久化：写入最终任务状态与性能指标
    if (db) {
      await db.updateTask(taskId, {
        status: finalTaskStatus,
        step: "GITHUB_NOTIFY",
        targetException: result.targetException,
        reproScript: result.finalScript,
        actualTraceback: result.actualTraceback,
        retryCount: result.retryCount,
        durationMs: result.durationMs,
      }).catch(() => {});

      await db.recordAuditLog(
        taskId,
        "GITHUB_NOTIFY",
        `复现任务完成，最终状态: ${finalTaskStatus}`,
        {
          retryCount: result.retryCount,
          durationMs: result.durationMs,
          status: result.status,
        }
      ).catch(() => {});
    }

    return {
      status: result.status,
      verified: isVerified,
      durationMs: result.durationMs,
    };
  } catch (err: unknown) {
    if (db) {
      const errMessage = err instanceof Error ? err.message : String(err);
      await db.updateTask(taskId, {
        status: "FAILED",
        errorMessage: errMessage,
      }).catch(() => {});
      await db.recordAuditLog(taskId, "FAILED", `任务执行遭遇致命异常: ${errMessage}`).catch(() => {});
    }
    throw err;
  } finally {
    // 7. 确保彻底清理浅克隆临时目录
    await fs.rm(tempRepoDir, { recursive: true, force: true });
  }
}

/**
 * 创建并启动 BullMQ 消费 Worker 进程
 */
export function startReproWorker(
  getOctokitForApp: () => OctokitClient,
  customConnection?: Redis
): Worker<IssuePayload> {
  const connection = customConnection || getRedisClient();

  const worker = new Worker<IssuePayload>(
    QUEUE_NAME,
    async (job) => {
      const octokit = getOctokitForApp();
      return processReproJob(job, { octokit });
    },
    {
      connection,
      concurrency: 2, // 单台实例并发 2 个沙箱执行
    }
  );

  worker.on("completed", (job) => {
    console.log(`[RepoClaw Worker]: Job ${job.id} for ${job.data.repoFullName}#${job.data.issueNumber} completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[RepoClaw Worker]: Job ${job?.id} failed:`, err);
  });

  return worker;
}
