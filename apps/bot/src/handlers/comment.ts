import type { Context } from "probot";
import {
  buildIssuePayload,
  isAuthorizedSender,
  isChatOpsCommand,
} from "../gateway/filter.js";
import { enqueueReproTask } from "../queue/repro-queue.js";
import { processReproJob } from "../queue/repro-worker.js";
import { getDatabase, type ReproTaskRepository } from "../db/index.js";

/**
 * 处理 GitHub issue_comment.created 事件
 */
export async function handleIssueCommentCreated(
  context: Context<"issue_comment.created">,
  customDb?: ReproTaskRepository
) {
  const { comment, issue, repository } = context.payload;

  // 1. 忽略机器人自身发表的评论，杜绝无限递归死循环
  if (comment.user.type === "Bot") {
    return;
  }

  // 2. 意图过滤：仅当评论明确包含 @repoclaw repro 指令时响应
  if (!isChatOpsCommand(comment.body)) {
    return;
  }

  context.log.info(
    `[RepoClaw Gateway]: 收到来自 @${comment.user.login} 的复现指令 (${repository.full_name}#${issue.number})`
  );

  // 3. 严格权限鉴权：必须为 OWNER / MEMBER / COLLABORATOR (防刷单与 Token 滥用)
  const authorAssociation = comment.author_association;
  if (!isAuthorizedSender(authorAssociation)) {
    context.log.warn(
      `[RepoClaw Gateway]: 拦截未授权用户 @${comment.user.login} (身份: ${authorAssociation})`
    );
    await context.octokit.issues.createComment(
      context.issue({
        body: `> ⚠️ **权限不足提示**：RepoClaw 自主复现指令仅限仓库协作者及维护者（\`OWNER\`、\`MEMBER\` 或 \`COLLABORATOR\`）调用，以防止计算资源与 Token 滥用。`,
      })
    );
    return;
  }

  // 4. 即时响应 (Immediate Feedback < 1.5s)：立即向触发评论添加 👀 (Eyes) 反应，告知用户已入队
  try {
    await context.octokit.reactions.createForIssueComment({
      owner: repository.owner.login,
      repo: repository.name,
      comment_id: comment.id,
      content: "eyes",
    });
  } catch (err) {
    context.log.warn(`[RepoClaw Gateway]: 添加 👀 表情失败 (可能缺少权限): ${err}`);
  }

  // 5. 构建标准任务载荷
  const payload = buildIssuePayload({
    repoOwner: repository.owner.login,
    repoName: repository.name,
    cloneUrl: repository.clone_url,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueBody: issue.body || "",
    commentId: comment.id,
    commentSender: comment.user.login,
    authorAssociation,
    installationId: context.payload.installation?.id,
  });

  // 6. 审计持久化：写入任务初始记录与审计流水
  try {
    const db = customDb || (await getDatabase());
    const now = new Date().toISOString();
    await db.createTask({
      id: payload.id,
      repoFullName: payload.repoFullName,
      issueNumber: payload.issueNumber,
      commentId: payload.commentId,
      triggerUser: payload.triggerUser,
      status: "PENDING",
      step: "INIT",
      createdAt: now,
      updatedAt: now,
    });
    await db.recordAuditLog(
      payload.id,
      "INIT",
      `收到维护者 @${payload.triggerUser} 指令，任务已登记`,
      { authorAssociation: payload.authorAssociation }
    );
  } catch (dbErr) {
    context.log.warn(`[RepoClaw DB Warning]: 记录初始任务失败: ${dbErr}`);
  }

  // 7. 入队 BullMQ 削峰 (若遇到 Redis 连接异常则优雅降级为直连异步消费，确保 100% 任务执行交付)
  try {
    const taskId = await enqueueReproTask(payload);
    context.log.info(`[RepoClaw Gateway]: 任务已成功入队 BullMQ，Task ID: ${taskId}`);
  } catch (queueErr) {
    context.log.warn(`[RepoClaw Gateway]: BullMQ 队列入队受阻，启用本地异步降级管道: ${queueErr}`);
    const jobLike: any = {
      data: payload,
      updateProgress: (prog: any) => {
        context.log.info(`[RepoClaw Progress]: ${JSON.stringify(prog)}`);
      },
    };
    processReproJob(jobLike, {
      octokit: context.octokit as any,
    }).catch((execErr) => {
      context.log.error(`[RepoClaw Fallback Execution Error]: ${execErr}`);
    });
  }
}
