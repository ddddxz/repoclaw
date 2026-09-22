import crypto from "node:crypto";
import { IssuePayloadSchema, type IssuePayload } from "@repoclaw/shared";

/**
 * 允许触发复现指令的角色白名单 (严格防刷单与 Token 盗刷)
 */
export const AUTHORIZED_ASSOCIATIONS = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

/**
 * 检查评论内容是否包含 @repoclaw repro 指令 (大小写不敏感)
 */
export function isChatOpsCommand(body?: string | null): boolean {
  if (!body) return false;
  return /@repoclaw\s+repro\b/i.test(body);
}

/**
 * 校验评论者是否具备维护者权限
 */
export function isAuthorizedSender(authorAssociation?: string | null): boolean {
  if (!authorAssociation) return false;
  return AUTHORIZED_ASSOCIATIONS.has(authorAssociation.toUpperCase());
}

export interface RawCommentContext {
  repoOwner: string;
  repoName: string;
  cloneUrl: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  commentId: number;
  commentSender: string;
  authorAssociation: string;
  installationId?: number;
}

/**
 * 结构化构建并校验 Issue 载荷模型
 */
export function buildIssuePayload(raw: RawCommentContext): IssuePayload {
  const payload: IssuePayload = {
    id: crypto.randomUUID(),
    repoFullName: `${raw.repoOwner}/${raw.repoName}`,
    repoCloneUrl: raw.cloneUrl,
    issueNumber: raw.issueNumber,
    issueTitle: raw.issueTitle,
    issueBody: raw.issueBody,
    commentId: raw.commentId,
    triggerUser: raw.commentSender,
    authorAssociation: raw.authorAssociation.toUpperCase() as "OWNER" | "MEMBER" | "COLLABORATOR",
    installationId: raw.installationId,
  };

  return IssuePayloadSchema.parse(payload);
}
