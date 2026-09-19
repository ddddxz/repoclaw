import type { Probot } from "probot";
import { handleIssueCommentCreated } from "./handlers/comment.js";
import { startReproWorker } from "./queue/repro-worker.js";

/**
 * RepoClaw GitHub App 核心主进程
 */
export default function repoClawApp(app: Probot) {
  app.log.info("🐾 RepoClaw 自主复现数字维护者服务已就绪！");

  // 1. 注册 ChatOps 评论事件监听
  app.on("issue_comment.created", handleIssueCommentCreated);

  // 2. 启动 BullMQ 任务消费 Worker 线程
  startReproWorker(() => {
    // Probot 提供 app.auth() 获取已认证的全局 Octokit
    return app.auth() as any;
  });
}
