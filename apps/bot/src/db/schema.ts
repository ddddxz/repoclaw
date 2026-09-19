import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * 复现任务主表 (repro_tasks)
 * 记录每次触发复现流程的完整生命周期、最终状态、生成的复现代码与真实堆栈
 */
export const reproTasks = sqliteTable("repro_tasks", {
  id: text("id").primaryKey(),
  repoFullName: text("repo_full_name").notNull(),
  issueNumber: integer("issue_number").notNull(),
  commentId: integer("comment_id").notNull(),
  triggerUser: text("trigger_user").notNull(),
  status: text("status").notNull().default("PENDING"),
  step: text("step").default("INIT"),
  targetException: text("target_exception"),
  reproScript: text("repro_script"),
  actualTraceback: text("actual_traceback"),
  retryCount: integer("retry_count").notNull().default(0),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  durationMs: integer("duration_ms").default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * 任务生命周期审计日志表 (task_audit_logs)
 * 记录每次状态机流转、沙箱启动、重试反思等关键节点事件
 */
export const taskAuditLogs = sqliteTable("task_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").notNull(),
  step: text("step").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

export type ReproTask = typeof reproTasks.$inferSelect;
export type NewReproTask = typeof reproTasks.$inferInsert;
export type TaskAuditLog = typeof taskAuditLogs.$inferSelect;
export type NewTaskAuditLog = typeof taskAuditLogs.$inferInsert;
