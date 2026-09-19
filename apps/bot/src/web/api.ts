import type { Request, Response } from "express";
import { type ReproTaskRepository } from "../db/index.js";

/**
 * 仪表盘与外部 RESTful API 处理器
 */
export function createApiHandlers(getRepo: () => Promise<ReproTaskRepository>) {
  return {
    /**
     * GET /api/stats - 获取全局 KPI 聚合统计
     */
    async getStats(_req: Request, res: Response): Promise<void> {
      try {
        const repo = await getRepo();
        const stats = await repo.getStats();
        res.json(stats);
      } catch (err: unknown) {
        res.status(500).json({ error: String(err) });
      }
    },

    /**
     * GET /api/tasks - 获取任务列表 (支持 repo 与 limit 过滤)
     */
    async getTasks(req: Request, res: Response): Promise<void> {
      try {
        const repo = await getRepo();
        const repoFullName = typeof req.query.repo === "string" ? req.query.repo : undefined;
        const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;

        const tasks = await repo.listTasks(repoFullName, limit);
        res.json({ tasks });
      } catch (err: unknown) {
        res.status(500).json({ error: String(err) });
      }
    },

    /**
     * GET /api/tasks/:id - 获取单笔任务详情与关联的生命周期审计流水
     */
    async getTaskDetail(req: Request, res: Response): Promise<void> {
      try {
        const repo = await getRepo();
        const idParam = req.params.id;
        const taskId = Array.isArray(idParam) ? idParam[0] : idParam;
        if (!taskId) {
          res.status(400).json({ error: "Missing taskId parameter" });
          return;
        }

        const task = await repo.getTask(taskId);
        if (!task) {
          res.status(404).json({ error: `Task not found: ${taskId}` });
          return;
        }

        const auditLogs = await repo.getAuditLogs(taskId);
        res.json({ task, auditLogs });
      } catch (err: unknown) {
        res.status(500).json({ error: String(err) });
      }
    },
  };
}
