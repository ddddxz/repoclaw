import type { Context } from "probot";
import {
  buildIssuePayload,
  isAuthorizedSender,
  isChatOpsCommand,
} from "../gateway/filter.js";
import { enqueueReproTask } from "../queue/repro-queue.js";

/**
 * 处理 GitHub issue_comment.created 事件
 */
export async function handleIssueCommentCreated(context: Context<"issue_comment.created">) {
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

  // 5. 构建标准任务载荷并入队 BullMQ 削峰
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
  });

  const taskId = await enqueueReproTask(payload);
  context.log.info(`[RepoClaw Gateway]: 任务已成功入队，Task ID: ${taskId}`);
}
