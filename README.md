# RepoClaw

> 面向 GitHub 开源仓库的自主 Bug 复现与最小用例合成数字维护者 (Autonomous Issue Reproducer & Test Synthesizer)

---

## 项目简介

**RepoClaw** 是一个基于 **TypeScript / Node.js** 全栈生态构建的常驻 GitHub App。当维护者在 Issue 下通过 ChatOps 指令（`@repoclaw repro`）触发时，系统在经过严格鉴权后动态拉起安全隔离的 Docker 容器沙箱，通过大模型驱动的自愈反思闭环自主提取报错特征、推导复现逻辑、合成最小隔离复现脚本并在沙箱中验证，最终将测试用例与真实堆栈结构化回写到 GitHub 评论区并打上 `reproduced` 标签。

---

## 核心设计文档

项目所有核心架构与规划文档统一归档于 [`docs/`](./docs) 目录：

1. [产品需求文档 (PRD)](./docs/PRD.md)：阐述产品背景痛点、核心价值定位、端到端用户流（User Flow）、功能性需求（FR-1 ~ FR-4）与非功能性需求（NFR）。
2. [技术架构与规范设计书 (TECH_SPEC)](./docs/TECH_SPEC.md)：定义技术选型矩阵、Monorepo 目录划分、Zod 数据契约、Dockerode 沙箱安全硬配置、SQLite 审计持久化以及自愈状态机。
3. [系统架构与设计说明书 (architecture)](./docs/architecture.md)：包含完整 Mermaid 系统用例图、系统分层架构图、ChatOps 端到端执行时序流程图以及沙箱防逃逸隔离机制。
4. [开源生态集成与二次开发架构指南 (OPEN_SOURCE_ECOSYSTEM)](./docs/OPEN_SOURCE_ECOSYSTEM.md)：深入剖析 OpenClaw、DeepSeek Harness、Codex Harness 标杆开源项目，确立“绝不重复造轮子”的二开技术路线。
5. [工程实施任务清单 (task)](./docs/task.md)：从 M1 到 M5 的细粒度工程实施路线图与任务分解（脚手架、沙箱隔离器、Agent 核心、Probot 网关与开源发布）。

---

## 技术选型一览

- **运行时与语言**：TypeScript 5.x / Node.js 22 LTS (ESM)
- **Monorepo 管理**：pnpm workspace + Turborepo
- **GitHub App 框架**：Probot 13.x
- **异步任务队列**：BullMQ 5.x + Redis 7.x
- **沙箱隔离引擎**：Dockerode 4.x + `python:3.11-slim`
- **大模型推理引擎**：Vercel AI SDK (`ai`) + DeepSeek-V3 / Qwen-2.5-Coder
- **持久化审计库**：SQLite 3 + Drizzle ORM
