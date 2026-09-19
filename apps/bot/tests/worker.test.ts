import { describe, it, expect, vi } from "vitest";
import { createClient } from "@libsql/client";
import * as coreModule from "@repoclaw/core";
import { MockLlmProvider } from "@repoclaw/core";
import { MockSandboxRunner } from "@repoclaw/sandbox";
import type { IssuePayload } from "@repoclaw/shared";
import { processReproJob } from "../src/queue/repro-worker.js";
import { ReproTaskRepository } from "../src/db/index.js";

describe("@repoclaw/bot Worker 任务消费与 GitHub 结果回写测试", () => {
  it("当复现成功时，应自动回帖 Markdown、打标 [reproduced] 并贴 🚀", async () => {
    // Mock 浅克隆行为
    vi.spyOn(coreModule, "shallowCloneRepo").mockResolvedValue({ durationMs: 120 });

    const mockCreateComment = vi.fn().mockResolvedValue({});
    const mockAddLabels = vi.fn().mockResolvedValue({});
    const mockCreateReaction = vi.fn().mockResolvedValue({});

    const mockOctokit: any = {
      issues: {
        createComment: mockCreateComment,
        addLabels: mockAddLabels,
      },
      reactions: {
        createForIssueComment: mockCreateReaction,
      },
    };

    const mockJob: any = {
      data: {
        id: "task-001",
        repoFullName: "owner/cool-repo",
        repoCloneUrl: "https://github.com/owner/cool-repo.git",
        issueNumber: 42,
        issueTitle: "Zero division in calc",
        issueBody: "Calling divide(1, 0) triggers ZeroDivisionError",
        commentId: 555,
        triggerUser: "maintainer_dan",
        authorAssociation: "OWNER",
      } satisfies IssuePayload,
      updateProgress: vi.fn(),
    };

    const mockLlm = new MockLlmProvider({
      customReproPlan: () => ({
        targetException: "ZeroDivisionError",
        errorKeywords: ["division by zero"],
        reproScript: "result = 1 / 0\n",
        explanation: "触发除零异常",
      }),
    });

    const mockSandbox = new MockSandboxRunner();

    const jobResult = await processReproJob(mockJob, {
      octokit: mockOctokit,
      llmProvider: mockLlm,
      sandboxRunner: mockSandbox,
    });

    // 1. 验证任务执行返回成功
    expect(jobResult.status).toBe("VERIFIED");
    expect(jobResult.verified).toBe(true);

    // 2. 验证调用 Octokit 回复了包含详细报告的 Markdown
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "cool-repo",
      issue_number: 42,
      body: expect.stringContaining("RepoClaw 自动化 Bug 复现报告 (Verified)"),
    });

    // 3. 验证自动给 Issue 打上 [reproduced] 状态标签
    expect(mockAddLabels).toHaveBeenCalledWith({
      owner: "owner",
      repo: "cool-repo",
      issue_number: 42,
      labels: ["reproduced"],
    });

    // 4. 验证将评论的 👀 反应升级为 🚀 (Rocket)
    expect(mockCreateReaction).toHaveBeenCalledWith({
      owner: "owner",
      repo: "cool-repo",
      comment_id: 555,
      content: "rocket",
    });
  });

  it("当复现未成功时，应礼貌回帖说明并贴 😕 且不打标", async () => {
    vi.spyOn(coreModule, "shallowCloneRepo").mockResolvedValue({ durationMs: 90 });

    const mockCreateComment = vi.fn().mockResolvedValue({});
    const mockAddLabels = vi.fn().mockResolvedValue({});
    const mockCreateReaction = vi.fn().mockResolvedValue({});

    const mockOctokit: any = {
      issues: {
        createComment: mockCreateComment,
        addLabels: mockAddLabels,
      },
      reactions: {
        createForIssueComment: mockCreateReaction,
      },
    };

    const mockJob: any = {
      data: {
        id: "task-002",
        repoFullName: "owner/cool-repo",
        repoCloneUrl: "https://github.com/owner/cool-repo.git",
        issueNumber: 43,
        issueTitle: "Unreproducible glitch",
        issueBody: "Some mysterious text",
        commentId: 556,
        triggerUser: "maintainer_dan",
        authorAssociation: "OWNER",
      } satisfies IssuePayload,
      updateProgress: vi.fn(),
    };

    // 模拟正常退出且未触发预期异常
    const mockLlm = new MockLlmProvider();
    const mockSandbox = new MockSandboxRunner(() => ({
      exitCode: 0,
      stdout: "Clean exit",
      stderr: "",
    }));

    const jobResult = await processReproJob(mockJob, {
      octokit: mockOctokit,
      llmProvider: mockLlm,
      sandboxRunner: mockSandbox,
    });

    expect(jobResult.status).toBe("UNVERIFIED");
    expect(jobResult.verified).toBe(false);

    // 1. 验证绝不添加 [reproduced] 标签
    expect(mockAddLabels).not.toHaveBeenCalled();

    // 2. 验证将表情更新为 😕 (Confused)
    expect(mockCreateReaction).toHaveBeenCalledWith({
      owner: "owner",
      repo: "cool-repo",
      comment_id: 556,
      content: "confused",
    });

    // 3. 验证回帖礼貌追问
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "cool-repo",
      issue_number: 43,
      body: expect.stringContaining("RepoClaw 复现尝试反馈 (Clarification Needed)"),
    });
  });

  it("当关联 SQLite 数据库时，应全生命周期记录状态与审计流水", async () => {
    vi.spyOn(coreModule, "shallowCloneRepo").mockResolvedValue({ durationMs: 50 });

    const client = createClient({ url: ":memory:" });
    const repo = new ReproTaskRepository(client);
    await repo.initSchema();

    const taskId = "task-audit-123";
    const now = new Date().toISOString();
    await repo.createTask({
      id: taskId,
      repoFullName: "owner/cool-repo",
      issueNumber: 88,
      commentId: 666,
      triggerUser: "maintainer_dan",
      status: "PENDING",
      step: "INIT",
      createdAt: now,
      updatedAt: now,
    });

    const mockJob: any = {
      data: {
        id: taskId,
        repoFullName: "owner/cool-repo",
        repoCloneUrl: "https://github.com/owner/cool-repo.git",
        issueNumber: 88,
        issueTitle: "Zero division in test",
        issueBody: "Calling zero triggers ZeroDivisionError",
        commentId: 666,
        triggerUser: "maintainer_dan",
        authorAssociation: "OWNER",
      } satisfies IssuePayload,
      updateProgress: vi.fn(),
    };

    const mockLlm = new MockLlmProvider();
    const mockSandbox = new MockSandboxRunner();

    await processReproJob(mockJob, {
      llmProvider: mockLlm,
      sandboxRunner: mockSandbox,
      db: repo,
    });

    const recordedTask = await repo.getTask(taskId);
    expect(recordedTask?.status).toBe("VERIFIED");
    expect(recordedTask?.reproScript).toBeDefined();
    expect(recordedTask?.actualTraceback).toBeDefined();

    const logs = await repo.getAuditLogs(taskId);
    expect(logs.length).toBeGreaterThan(2);
    const steps = logs.map((l) => l.step);
    expect(steps).toContain("CLONING");
    expect(steps).toContain("GITHUB_NOTIFY");

    await repo.close();
  });
});
