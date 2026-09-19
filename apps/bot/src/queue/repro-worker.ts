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

export type OctokitClient = InstanceType<typeof ProbotOctokit>;

export interface WorkerDependencies {
  octokit?: OctokitClient;
  llmProvider?: ILLMProvider;
  sandboxRunner?: ISandboxRunner;
}

/**
 * 核心复现任务执行器逻辑 (可单元测试)
 */
export async function processReproJob(
  job: Job<IssuePayload>,
  deps?: WorkerDependencies
): Promise<{ status: string; verified: boolean; durationMs: number }> {
  const payload = job.data;
  const [owner, repo] = payload.repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`非法仓库名: ${payload.repoFullName}`);
  }

  const tempRepoDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `repoclaw-${owner}-${repo}-${payload.issueNumber}-`)
  );

  try {
    // 1. 极速浅克隆目标仓库
    await shallowCloneRepo(payload.repoCloneUrl, tempRepoDir);

    // 2. 初始化核心 Agent 与沙箱
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
      onStepChange: (step, detail) => {
        job.updateProgress({ step, detail });
      },
    });

    // 3. 执行状态机自愈反思闭环
    const result = await agent.execute();

    // 4. 回写 GitHub: 发帖、打标、更新 Reaction 表情
    if (deps?.octokit) {
      const octokit = deps.octokit;

      // 4.1 回复结构化 Markdown 报告
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: payload.issueNumber,
        body: result.markdownReport,
      });

      // 4.2 若复现成功，打上 [reproduced] 标签并贴 🚀
      if (result.status === "VERIFIED") {
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

    return {
      status: result.status,
      verified: result.status === "VERIFIED",
      durationMs: result.durationMs,
    };
  } finally {
    // 5. 确保彻底清理浅克隆临时目录
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
