import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import { createClient, type Client } from "@libsql/client";
import * as coreModule from "@repoclaw/core";
import { MockLlmProvider } from "@repoclaw/core";
import { MockSandboxRunner } from "@repoclaw/sandbox";
import type { IssuePayload } from "@repoclaw/shared";
import { ReproTaskRepository } from "../src/db/index.js";
import { handleIssueCommentCreated } from "../src/handlers/comment.js";
import { processReproJob } from "../src/queue/repro-worker.js";
import * as queueModule from "../src/queue/repro-queue.js";
import { createWebRouter } from "../src/web/router.js";

describe("RepoClaw 全链路端到端 (E2E) 闭环集成测试", () => {
  let client: Client;
  let repo: ReproTaskRepository;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    // 1. 初始化纯内存测试数据库
    client = createClient({ url: ":memory:" });
    repo = new ReproTaskRepository(client);
    await repo.initSchema();

    // 2. 挂载 Web 服务并启动测试服务器
    const app = express();
    const router = createWebRouter(repo);
    app.use(router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await repo.close();
    vi.restoreAllMocks();
  });

  it("【完整 E2E 场景】未授权用户调用被拦截 ➔ 授权维护者触发 ➔ 👀 响应 ➔ 异步执行 ➔ 沙箱闭环 ➔ 回帖打标 🚀 ➔ Web 看板一致性", async () => {
    // ==========================================
    // 阶段 1: 未授权贡献者触发指令 (防盗刷测试)
    // ==========================================
    const mockUnauthorizedComment = vi.fn().mockResolvedValue({});
    const mockUnauthorizedReaction = vi.fn();
    const enqueueSpy = vi.spyOn(queueModule, "enqueueReproTask");

    const unauthorizedContext: any = {
      payload: {
        comment: {
          id: 1001,
          body: "@repoclaw repro 请帮我跑一下",
          user: { login: "malicious_user", type: "User" },
          author_association: "CONTRIBUTOR", // 非维护者
        },
        issue: {
          number: 55,
          title: "Potential memory leak",
          body: "Details...",
        },
        repository: {
          name: "test-repo",
          owner: { login: "ddddxz" },
          full_name: "ddddxz/test-repo",
          clone_url: "https://github.com/ddddxz/test-repo.git",
        },
      },
      log: { info: vi.fn(), warn: vi.fn() },
      issue: (obj: any) => ({
        owner: "ddddxz",
        repo: "test-repo",
        issue_number: 55,
        ...obj,
      }),
      octokit: {
        issues: { createComment: mockUnauthorizedComment },
        reactions: { createForIssueComment: mockUnauthorizedReaction },
      },
    };

    await handleIssueCommentCreated(unauthorizedContext, repo);

    // 验证未授权拦截
    expect(mockUnauthorizedReaction).not.toHaveBeenCalled();
    expect(mockUnauthorizedComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("权限不足提示"),
      })
    );
    expect(enqueueSpy).not.toHaveBeenCalled();

    // 验证此时数据库仍无任务
    const initialStats = await repo.getStats();
    expect(initialStats.total).toBe(0);

    // ==========================================
    // 阶段 2: 授权维护者触发 @repoclaw repro
    // ==========================================
    const mockCreatedComment = vi.fn().mockResolvedValue({});
    const mockAddLabels = vi.fn().mockResolvedValue({});
    const mockCreateReaction = vi.fn().mockResolvedValue({});

    let capturedPayload: IssuePayload | null = null;
    enqueueSpy.mockImplementation(async (payload: IssuePayload) => {
      capturedPayload = payload;
      return payload.id;
    });

    const authorizedContext: any = {
      payload: {
        comment: {
          id: 1002,
          body: "@repoclaw repro 验证除零 Bug",
          user: { login: "ddddxz", type: "User" },
          author_association: "OWNER",
        },
        issue: {
          number: 56,
          title: "ZeroDivisionError in calculate_metrics",
          body: "Calling calculate_metrics(0) crashes with ZeroDivisionError",
        },
        repository: {
          name: "repoclaw-demo",
          owner: { login: "ddddxz" },
          full_name: "ddddxz/repoclaw-demo",
          clone_url: "https://github.com/ddddxz/repoclaw-demo.git",
        },
      },
      log: { info: vi.fn(), warn: vi.fn() },
      issue: (obj: any) => ({
        owner: "ddddxz",
        repo: "repoclaw-demo",
        issue_number: 56,
        ...obj,
      }),
      octokit: {
        issues: {
          createComment: mockCreatedComment,
          addLabels: mockAddLabels,
        },
        reactions: {
          createForIssueComment: mockCreateReaction,
        },
      },
    };

    await handleIssueCommentCreated(authorizedContext, repo);

    // 1. 验证即时反应添加了 👀
    expect(mockCreateReaction).toHaveBeenCalledWith({
      owner: "ddddxz",
      repo: "repoclaw-demo",
      comment_id: 1002,
      content: "eyes",
    });

    // 2. 验证任务载荷入队
    expect(capturedPayload).not.null;
    const taskPayload = capturedPayload!;
    expect(taskPayload.repoFullName).toBe("ddddxz/repoclaw-demo");
    expect(taskPayload.triggerUser).toBe("ddddxz");

    // 3. 验证此时数据库已记录任务为 PENDING 状态
    const pendingTask = await repo.getTask(taskPayload.id);
    expect(pendingTask).toBeDefined();
    expect(pendingTask?.status).toBe("PENDING");
    expect(pendingTask?.step).toBe("INIT");

    // ==========================================
    // 阶段 3: 异步 Worker 消费与 Agent 执行闭环
    // ==========================================
    // Mock 浅克隆以隔离网络波动
    vi.spyOn(coreModule, "shallowCloneRepo").mockResolvedValue({ durationMs: 150 });

    const mockLlm = new MockLlmProvider({
      customReproPlan: () => ({
        targetException: "ZeroDivisionError",
        errorKeywords: ["division by zero"],
        reproScript: "import sys\nresult = 1 / 0\n",
        explanation: "通过除以 0 触发目标 ZeroDivisionError 异常",
      }),
    });

    const mockSandbox = new MockSandboxRunner();

    const mockJob: any = {
      data: taskPayload,
      updateProgress: vi.fn(),
    };

    const workerResult = await processReproJob(mockJob, {
      octokit: authorizedContext.octokit,
      llmProvider: mockLlm,
      sandboxRunner: mockSandbox,
      db: repo,
    });

    // 4. 验证 Worker 执行成功
    expect(workerResult.status).toBe("VERIFIED");
    expect(workerResult.verified).toBe(true);

    // 5. 验证 GitHub 回写评论与标签
    expect(mockCreatedComment).toHaveBeenCalledWith({
      owner: "ddddxz",
      repo: "repoclaw-demo",
      issue_number: 56,
      body: expect.stringContaining("RepoClaw 自动化 Bug 复现报告 (Verified)"),
    });

    expect(mockAddLabels).toHaveBeenCalledWith({
      owner: "ddddxz",
      repo: "repoclaw-demo",
      issue_number: 56,
      labels: ["reproduced"],
    });

    // 6. 验证反应升级为 🚀 (Rocket)
    expect(mockCreateReaction).toHaveBeenCalledWith({
      owner: "ddddxz",
      repo: "repoclaw-demo",
      comment_id: 1002,
      content: "rocket",
    });

    // ==========================================
    // 阶段 4: Web 审计看板与 HTTP REST API 一致性验证
    // ==========================================
    // 4.1 探针端点验证
    const healthRes = await fetch(`${baseUrl}/healthz`);
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe("ok");

    // 4.2 全局统计 API 验证
    const statsRes = await fetch(`${baseUrl}/api/stats`);
    expect(statsRes.status).toBe(200);
    const statsData = await statsRes.json();
    expect(statsData.total).toBe(1);
    expect(statsData.verified).toBe(1);
    expect(statsData.successRate).toBe(100);
    expect(statsData.failed).toBe(0);

    // 4.3 任务列表与详情 API 验证
    const tasksRes = await fetch(`${baseUrl}/api/tasks`);
    expect(tasksRes.status).toBe(200);
    const tasksData = await tasksRes.json();
    expect(tasksData.tasks).toHaveLength(1);
    expect(tasksData.tasks[0].status).toBe("VERIFIED");
    expect(tasksData.tasks[0].targetException).toBe("ZeroDivisionError");

    const taskDetailRes = await fetch(`${baseUrl}/api/tasks/${taskPayload.id}`);
    expect(taskDetailRes.status).toBe(200);
    const taskDetailData = await taskDetailRes.json();
    expect(taskDetailData.task.id).toBe(taskPayload.id);
    expect(taskDetailData.auditLogs.length).toBeGreaterThanOrEqual(4);

    const recordedSteps = taskDetailData.auditLogs.map((l: any) => l.step);
    expect(recordedSteps).toContain("INIT");
    expect(recordedSteps).toContain("CLONING");
    expect(recordedSteps).toContain("GITHUB_NOTIFY");
  });
});
