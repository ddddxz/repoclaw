import { run, type Probot } from "probot";
import type { Router } from "express";
import { handleIssueCommentCreated } from "./handlers/comment.js";
import { startReproWorker } from "./queue/repro-worker.js";
import { createWebRouter } from "./web/router.js";

export interface ProbotOptions {
  getRouter?: (path?: string) => Router;
}

/**
 * RepoClaw GitHub App 核心主进程 (集成 Web 官网、审计看板与 ChatOps 调度)
 */
export default function repoClawApp(app: Probot, { getRouter }: ProbotOptions = {}) {
  app.log.info("🐾 RepoClaw 自主复现数字维护者服务已就绪！");

  // 1. 注册 Web 开发者官网与实时任务审计看板路由
  if (getRouter) {
    const rootRouter = getRouter();
    const webRouter = createWebRouter();
    rootRouter.use("/", webRouter);
    app.log.info("🌐 Web 官网与实时任务审计看板已挂载至 http://localhost:3000/");
  }

  // 2. 注册 ChatOps 评论事件监听
  app.on("issue_comment.created", handleIssueCommentCreated);

  // 3. 启动 BullMQ 任务消费 Worker 线程
  startReproWorker(() => {
    // Probot 提供 app.auth() 获取已认证的全局 Octokit
    return app.auth() as any;
  });
}

// 当直接执行该文件时 (node dist/index.js)，自动启动 Probot Server
const isDirectRun = process.argv[1] && (
  process.argv[1].replace(/\\/g, "/").endsWith("dist/index.js") ||
  process.argv[1].replace(/\\/g, "/").endsWith("src/index.ts")
);

if (isDirectRun) {
  run(repoClawApp);
}
