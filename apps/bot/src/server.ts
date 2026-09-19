import express from "express";
import { createWebRouter } from "./web/router.js";
import { config } from "./config.js";

const app = express();
const port = config.port || 3000;

const router = createWebRouter();
app.use("/", router);

app.listen(port, () => {
  console.log(`\n🐾 ===============================================`);
  console.log(`🌐 RepoClaw Web 官网与实时审计看板服务已成功启动！`);
  console.log(`👉 开发者官网地址:   http://localhost:${port}/`);
  console.log(`👉 实时任务审计看板: http://localhost:${port}/dashboard`);
  console.log(`👉 全局统计 API:     http://localhost:${port}/api/stats`);
  console.log(`🐾 ===============================================\n`);
});
