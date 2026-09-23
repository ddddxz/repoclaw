import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import { createClient, type Client } from "@libsql/client";
import { ReproTaskRepository } from "../src/db/index.js";
import { createWebRouter } from "../src/web/router.js";

describe("RepoClaw 内置 Web 官网与实时任务审计看板测试", () => {
  let client: Client;
  let repo: ReproTaskRepository;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    // 1. 初始化纯内存测试数据库
    client = createClient({ url: ":memory:" });
    repo = new ReproTaskRepository(client);
    await repo.initSchema();

    // 2. 装配 Web 路由并启动本地 HTTP 测试服务器
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
  });

  it("GET /healthz 与 /api/health 应返回 200 OK 与服务健康指标", async () => {
    const res1 = await fetch(`${baseUrl}/healthz`);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe("ok");
    expect(data1.service).toBe("repoclaw-bot");
    expect(typeof data1.uptime).toBe("number");

    const res2 = await fetch(`${baseUrl}/api/health`);
    expect(res2.status).toBe(200);
  });

  it("GET / 应当成功返回极客暗黑风 Landing 开发者官网页面", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("RepoClaw");
    expect(html).toContain("零信任 Docker 沙箱");
    expect(html).toContain("@repoclaw repro");
    expect(html).toContain("进入任务审计看板");
  });

  it("GET /dashboard 应当成功返回实时任务审计看板页面", async () => {
    const res = await fetch(`${baseUrl}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("Live Task Dashboard");
    expect(html).toContain("累计复现任务数");
    expect(html).toContain("复现成功率");
    expect(html).toContain("状态机生命周期审计流水");
  });

  it("GET /api/stats 应当准确返回全局 KPI 统计数据", async () => {
    const now = new Date().toISOString();
    // 注入两条模拟任务
    await repo.createTask({
      id: "stat-task-1",
      repoFullName: "org/repo1",
      issueNumber: 10,
      commentId: 100,
      triggerUser: "alice",
      status: "VERIFIED",
      durationMs: 2500,
      retryCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    await repo.createTask({
      id: "stat-task-2",
      repoFullName: "org/repo1",
      issueNumber: 11,
      commentId: 101,
      triggerUser: "bob",
      status: "UNVERIFIED",
      durationMs: 4500,
      retryCount: 2,
      createdAt: now,
      updatedAt: now,
    });

    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.total).toBe(2);
    expect(data.verified).toBe(1);
    expect(data.unverified).toBe(1);
    expect(data.successRate).toBe(50);
    expect(data.avgDurationMs).toBe(3500);
    expect(data.totalRetries).toBe(3);
  });

  it("GET /api/tasks 应当返回最新任务列表并支持按仓库过滤", async () => {
    const now = new Date().toISOString();
    await repo.createTask({
      id: "task-list-1",
      repoFullName: "fastapi/fastapi",
      issueNumber: 1,
      commentId: 10,
      triggerUser: "tiangolo",
      status: "VERIFIED",
      createdAt: now,
      updatedAt: now,
    });
    await repo.createTask({
      id: "task-list-2",
      repoFullName: "pallets/flask",
      issueNumber: 2,
      commentId: 20,
      triggerUser: "david",
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    // 1. 获取全量
    const resAll = await fetch(`${baseUrl}/api/tasks`);
    expect(resAll.status).toBe(200);
    const dataAll = await resAll.json();
    expect(dataAll.tasks).toHaveLength(2);

    // 2. 仓库名过滤
    const resFiltered = await fetch(`${baseUrl}/api/tasks?repo=fastapi/fastapi`);
    expect(resFiltered.status).toBe(200);
    const dataFiltered = await resFiltered.json();
    expect(dataFiltered.tasks).toHaveLength(1);
    expect(dataFiltered.tasks[0].id).toBe("task-list-1");
  });

  it("GET /api/tasks/:id 应当能拉取指定任务的详情以及全部审计日志流水", async () => {
    const taskId = "task-detail-999";
    const now = new Date().toISOString();

    await repo.createTask({
      id: taskId,
      repoFullName: "django/django",
      issueNumber: 500,
      commentId: 888,
      triggerUser: "core_dev",
      status: "VERIFIED",
      targetException: "OperationalError",
      reproScript: "connection.cursor()",
      actualTraceback: "Traceback ... OperationalError",
      durationMs: 3200,
      createdAt: now,
      updatedAt: now,
    });

    // 追加两条生命周期审计日志
    await repo.recordAuditLog(taskId, "CLONING", "正在克隆代码");
    await repo.recordAuditLog(taskId, "GITHUB_NOTIFY", "已回复 Issue 评论");

    const res = await fetch(`${baseUrl}/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.task.id).toBe(taskId);
    expect(data.task.targetException).toBe("OperationalError");
    expect(data.task.reproScript).toBe("connection.cursor()");
    expect(data.auditLogs).toHaveLength(2);
    expect(data.auditLogs[0].step).toBe("CLONING");
    expect(data.auditLogs[1].step).toBe("GITHUB_NOTIFY");
  });

  it("GET /api/tasks/:id 遇到不存在的任务应返回 404", async () => {
    const res = await fetch(`${baseUrl}/api/tasks/non-existent-task-id`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Task not found");
  });
});
