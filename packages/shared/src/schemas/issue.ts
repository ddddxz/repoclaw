import { z } from "zod";

/**
 * 持久化任务主状态枚举（与 SQLite 审计表一致）
 */
export const TaskStatusEnum = z.enum([
  "PENDING",      // 排队等待执行
  "RUNNING",      // 任务正在执行中 (克隆/生成/沙箱执行)
  "VERIFIED",     // 成功捕获目标异常并验证通过
  "UNVERIFIED",   // 执行无报错或变异后仍未达复现条件
  "FAILED",       // 语法/环境错误超出最大重试次数或硬超时
]);

export type TaskStatus = z.infer<typeof TaskStatusEnum>;

/**
 * 细粒度状态机执行步骤
 */
export const TaskStepEnum = z.enum([
  "INIT",
  "CLONING",
  "GENERATING",
  "SANDBOX_RUN",
  "REFLECTING",
  "GITHUB_NOTIFY",
]);

export type TaskStep = z.infer<typeof TaskStepEnum>;

/**
 * ChatOps 触发有效载荷模型
 */
export const IssuePayloadSchema = z.object({
  id: z.string().uuid().describe("任务唯一跟踪 ID (UUIDv4)"),
  repoFullName: z.string().describe("目标仓库全名 (如 owner/repo)"),
  repoCloneUrl: z.string().url().describe("仓库克隆地址"),
  issueNumber: z.number().int().positive().describe("Issue 序号"),
  issueTitle: z.string().describe("Issue 标题"),
  issueBody: z.string().describe("Issue 原始提报正文与堆栈"),
  commentId: z.number().int().positive().describe("触发指令的评论 ID"),
  triggerUser: z.string().describe("发起 ChatOps 指令的维护者用户名"),
  authorAssociation: z.enum(["OWNER", "MEMBER", "COLLABORATOR"]).describe("触发者权限角色"),
});

export type IssuePayload = z.infer<typeof IssuePayloadSchema>;
