import { Router, static as expressStatic, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderLandingPage, renderDashboardPage } from "./views.js";
import { createApiHandlers } from "./api.js";
import { getDatabase, type ReproTaskRepository } from "../db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 创建并配置 RepoClaw 统一 Web 路由
 */
export function createWebRouter(customDb?: ReproTaskRepository): Router {
  const router = Router();
  const getRepo = async () => customDb || (await getDatabase());
  const api = createApiHandlers(getRepo);

  // 1. 静态资产托管 (Logo, Banner 等高颜值图片)
  // 支持在开发模式 (src) 或编译后 (dist) 正确定位 public 目录
  const publicDir = path.resolve(__dirname, "../../public");
  router.use(expressStatic(publicDir));
  router.get("/images/:filename", (req: Request, res: Response) => {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!filename) {
      res.status(404).end();
      return;
    }
    const safeFilename = path.basename(filename);
    const filePath = path.join(publicDir, "images", safeFilename);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).end();
      }
    });
  });

  // 2. 健康检查与就绪探针 (用于 Docker / K8s / 云部署监控)
  router.get(["/healthz", "/api/health"], (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "repoclaw-bot",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // 2. 页面路由
  router.get("/", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderLandingPage());
  });

  router.get("/dashboard", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderDashboardPage());
  });

  // 3. RESTful API 路由
  router.get("/api/stats", (req: Request, res: Response) => api.getStats(req, res));
  router.get("/api/tasks", (req: Request, res: Response) => api.getTasks(req, res));
  router.get("/api/tasks/:id", (req: Request, res: Response) => api.getTaskDetail(req, res));

  return router;
}
