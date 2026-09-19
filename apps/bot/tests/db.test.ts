import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { ReproTaskRepository } from "../src/db/index.js";

describe("Milestone 4: ReproTaskRepository SQLite 审计持久化测试", () => {
  let client: Client;
  let repo: ReproTaskRepository;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    repo = new ReproTaskRepository(client);
    await repo.initSchema();
  });

  afterEach(async () => {
    await repo.close();
  });

  it("应当能够成功创建任务并正确持久化各个字段", async () => {
    const taskId = "task-uuid-101";
    const now = new Date().toISOString();

    await repo.createTask({
      id: taskId,
      repoFullName: "facebook/react",
      issueNumber: 42,
      commentId: 888,
      triggerUser: "alice",
      status: "QUEUED",
      step: "INITIALIZING",
      createdAt: now,
      updatedAt: now,
    });

    const task = await repo.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.id).toBe(taskId);
    expect(task?.repoFullName).toBe("facebook/react");
    expect(task?.issueNumber).toBe(42);
    expect(task?.status).toBe("QUEUED");
    expect(task?.step).toBe("INITIALIZING");
    expect(task?.triggerUser).toBe("alice");
  });

  it("应当能够流转更新任务状态、复现脚本与耗时", async () => {
    const taskId = "task-uuid-102";
    const now = new Date().toISOString();

    await repo.createTask({
      id: taskId,
      repoFullName: "pallets/flask",
      issueNumber: 100,
      commentId: 999,
      triggerUser: "bob",
      status: "QUEUED",
      step: "INITIALIZING",
      createdAt: now,
      updatedAt: now,
    });

    await repo.updateTask(taskId, {
      status: "SUCCESS",
      step: "COMPLETED",
      targetException: "ZeroDivisionError",
      reproScript: "print(1 / 0)",
      actualTraceback: "Traceback ... ZeroDivisionError",
      retryCount: 1,
      durationMs: 3500,
      promptTokens: 450,
      completionTokens: 120,
    });

    const updated = await repo.getTask(taskId);
    expect(updated?.status).toBe("SUCCESS");
    expect(updated?.step).toBe("COMPLETED");
    expect(updated?.targetException).toBe("ZeroDivisionError");
    expect(updated?.reproScript).toBe("print(1 / 0)");
    expect(updated?.retryCount).toBe(1);
    expect(updated?.durationMs).toBe(3500);
    expect(updated?.promptTokens).toBe(450);
  });

  it("应当能够按时间线追加和读取审计流水日志", async () => {
    const taskId = "task-uuid-103";
    const now = new Date().toISOString();

    await repo.createTask({
      id: taskId,
      repoFullName: "psf/requests",
      issueNumber: 50,
      commentId: 333,
      triggerUser: "charlie",
      createdAt: now,
      updatedAt: now,
    });

    await repo.recordAuditLog(taskId, "INITIALIZING", "任务已入队", { queue: "repro" });
    await repo.recordAuditLog(taskId, "RUNNING_SANDBOX", "沙箱容器已拉起", { containerId: "c-1" });
    await repo.recordAuditLog(taskId, "COMPLETED", "复现成功，已发表回复", { exitCode: 1 });

    const logs = await repo.getAuditLogs(taskId);
    expect(logs).toHaveLength(3);
    expect(logs[0].step).toBe("INITIALIZING");
    expect(logs[0].message).toBe("任务已入队");
    expect(JSON.parse(logs[0].metadata || "{}")).toEqual({ queue: "repro" });

    expect(logs[1].step).toBe("RUNNING_SANDBOX");
    expect(logs[2].step).toBe("COMPLETED");
  });

  it("应当能够按仓库列表分页查询任务", async () => {
    const now = new Date().toISOString();

    await repo.createTask({
      id: "task-1",
      repoFullName: "owner/repoA",
      issueNumber: 1,
      commentId: 10,
      triggerUser: "user1",
      createdAt: now,
      updatedAt: now,
    });

    await repo.createTask({
      id: "task-2",
      repoFullName: "owner/repoB",
      issueNumber: 2,
      commentId: 20,
      triggerUser: "user2",
      createdAt: now,
      updatedAt: now,
    });

    const repoATasks = await repo.listTasks("owner/repoA");
    expect(repoATasks).toHaveLength(1);
    expect(repoATasks[0].id).toBe("task-1");

    const allTasks = await repo.listTasks();
    expect(allTasks).toHaveLength(2);
  });
});
