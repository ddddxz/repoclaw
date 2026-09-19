import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { eq, desc } from "drizzle-orm";
import { reproTasks, taskAuditLogs, type ReproTask, type NewReproTask, type TaskAuditLog } from "./schema.js";

export * from "./schema.js";

export class ReproTaskRepository {
  private client: Client;
  public db: LibSQLDatabase<Record<string, unknown>>;

  constructor(client: Client) {
    this.client = client;
    this.db = drizzle(client);
  }

  /**
   * 初始化数据库表结构（开箱即用，自动迁移 DDL）
   */
  async initSchema(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS repro_tasks (
        id TEXT PRIMARY KEY,
        repo_full_name TEXT NOT NULL,
        issue_number INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        trigger_user TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        step TEXT DEFAULT 'INITIALIZING',
        target_exception TEXT,
        repro_script TEXT,
        actual_traceback TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS task_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        step TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  /**
   * 插入新的复现任务
   */
  async createTask(data: NewReproTask): Promise<void> {
    await this.db.insert(reproTasks).values(data);
  }

  /**
   * 更新复现任务状态或字段
   */
  async updateTask(taskId: string, data: Partial<Omit<ReproTask, "id">>): Promise<void> {
    await this.db
      .update(reproTasks)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(reproTasks.id, taskId));
  }

  /**
   * 记录生命周期审计流水日志
   */
  async recordAuditLog(
    taskId: string,
    step: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.db.insert(taskAuditLogs).values({
      taskId,
      step,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 根据 ID 查询任务详情
   */
  async getTask(taskId: string): Promise<ReproTask | undefined> {
    const results = await this.db
      .select()
      .from(reproTasks)
      .where(eq(reproTasks.id, taskId))
      .limit(1);
    return results[0];
  }

  /**
   * 查询指定仓库或全量的复现任务列表
   */
  async listTasks(repoFullName?: string, limit: number = 20): Promise<ReproTask[]> {
    if (repoFullName) {
      return await this.db
        .select()
        .from(reproTasks)
        .where(eq(reproTasks.repoFullName, repoFullName))
        .orderBy(desc(reproTasks.createdAt))
        .limit(limit);
    }
    return await this.db
      .select()
      .from(reproTasks)
      .orderBy(desc(reproTasks.createdAt))
      .limit(limit);
  }

  /**
   * 获取指定任务的所有审计流水
   */
  async getAuditLogs(taskId: string): Promise<TaskAuditLog[]> {
    return await this.db
      .select()
      .from(taskAuditLogs)
      .where(eq(taskAuditLogs.taskId, taskId));
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    this.client.close();
  }
}

/**
 * 数据库单例与工厂函数
 */
let defaultRepo: ReproTaskRepository | null = null;

export async function getDatabase(url?: string): Promise<ReproTaskRepository> {
  if (defaultRepo && !url) {
    return defaultRepo;
  }
  const dbUrl = url || process.env.DATABASE_URL || "file:repoclaw.db";
  const client = createClient({ url: dbUrl });
  const repo = new ReproTaskRepository(client);
  await repo.initSchema();

  if (!url) {
    defaultRepo = repo;
  }
  return repo;
}
