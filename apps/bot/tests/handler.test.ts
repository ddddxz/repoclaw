import { describe, it, expect, vi } from "vitest";
import { handleIssueCommentCreated } from "../src/handlers/comment.js";
import * as queueModule from "../src/queue/repro-queue.js";

describe("@repoclaw/bot issue_comment.created 事件处理测试", () => {
  it("当合法维护者发送 @repoclaw repro 时，应添加 👀 表情并成功将任务入队", async () => {
    const enqueueSpy = vi.spyOn(queueModule, "enqueueReproTask").mockResolvedValue("mock-task-123");

    const mockCreateReaction = vi.fn().mockResolvedValue({});
    const mockCreateComment = vi.fn().mockResolvedValue({});

    const mockContext: any = {
      payload: {
        comment: {
          id: 999,
          body: "@repoclaw repro 请协助验证此问题",
          user: { login: "alice_maintainer", type: "User" },
          author_association: "OWNER",
        },
        issue: {
          number: 101,
          title: "Memory leak in query processor",
          body: "Steps to reproduce: ...",
        },
        repository: {
          name: "demo-repo",
          owner: { login: "acme-corp" },
          full_name: "acme-corp/demo-repo",
          clone_url: "https://github.com/acme-corp/demo-repo.git",
        },
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      issue: (obj: any) => ({
        owner: "acme-corp",
        repo: "demo-repo",
        issue_number: 101,
        ...obj,
      }),
      octokit: {
        reactions: {
          createForIssueComment: mockCreateReaction,
        },
        issues: {
          createComment: mockCreateComment,
        },
      },
    };

    await handleIssueCommentCreated(mockContext);

    // 1. 验证必须在 1.5s 内添加 👀 表情
    expect(mockCreateReaction).toHaveBeenCalledWith({
      owner: "acme-corp",
      repo: "demo-repo",
      comment_id: 999,
      content: "eyes",
    });

    // 2. 验证任务入队被调用
    expect(enqueueSpy).toHaveBeenCalled();
    const calledPayload = enqueueSpy.mock.calls[0]?.[0];
    expect(calledPayload?.issueNumber).toBe(101);
    expect(calledPayload?.triggerUser).toBe("alice_maintainer");

    // 3. 不应触发权限警告回帖
    expect(mockCreateComment).not.toHaveBeenCalled();

    enqueueSpy.mockRestore();
  });

  it("当非维护者 (普通用户) 发送指令时，应回帖拒绝且不入队", async () => {
    const enqueueSpy = vi.spyOn(queueModule, "enqueueReproTask");
    const mockCreateReaction = vi.fn();
    const mockCreateComment = vi.fn().mockResolvedValue({});

    const mockContext: any = {
      payload: {
        comment: {
          id: 888,
          body: "@repoclaw repro",
          user: { login: "random_user", type: "User" },
          author_association: "CONTRIBUTOR", // 非维护者白名单
        },
        issue: {
          number: 102,
          title: "Crash bug",
          body: "Crash details",
        },
        repository: {
          name: "demo-repo",
          owner: { login: "acme-corp" },
          full_name: "acme-corp/demo-repo",
          clone_url: "https://github.com/acme-corp/demo-repo.git",
        },
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      issue: (obj: any) => ({
        owner: "acme-corp",
        repo: "demo-repo",
        issue_number: 102,
        ...obj,
      }),
      octokit: {
        reactions: {
          createForIssueComment: mockCreateReaction,
        },
        issues: {
          createComment: mockCreateComment,
        },
      },
    };

    await handleIssueCommentCreated(mockContext);

    // 1. 不添加 👀 表情
    expect(mockCreateReaction).not.toHaveBeenCalled();
    // 2. 绝不压入执行队列 (杜绝 Token 盗刷)
    expect(enqueueSpy).not.toHaveBeenCalled();
    // 3. 必须发表权限拦截警示
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("权限不足提示"),
      })
    );

    enqueueSpy.mockRestore();
  });

  it("当评论为机器人或非 ChatOps 指令时，应静默忽略", async () => {
    const enqueueSpy = vi.spyOn(queueModule, "enqueueReproTask");
    const mockCreateReaction = vi.fn();

    // 场景 A: 机器人自发评论
    const botContext: any = {
      payload: {
        comment: {
          id: 777,
          body: "@repoclaw repro",
          user: { login: "repoclaw[bot]", type: "Bot" },
          author_association: "OWNER",
        },
        issue: { number: 1 },
        repository: { full_name: "test/repo" },
      },
      log: { info: vi.fn(), warn: vi.fn() },
    };
    await handleIssueCommentCreated(botContext);
    expect(enqueueSpy).not.toHaveBeenCalled();

    // 场景 B: 普通聊天没有 @repoclaw repro
    const chatContext: any = {
      payload: {
        comment: {
          id: 778,
          body: "Thanks for checking this issue!",
          user: { login: "dev", type: "User" },
          author_association: "OWNER",
        },
        issue: { number: 1 },
        repository: { full_name: "test/repo" },
      },
      log: { info: vi.fn(), warn: vi.fn() },
    };
    await handleIssueCommentCreated(chatContext);
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(mockCreateReaction).not.toHaveBeenCalled();

    enqueueSpy.mockRestore();
  });
});
