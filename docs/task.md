# RepoClaw 工程实施任务清单 (Task Breakdown)

> 遵循 `PRD.md`、`TECH_SPEC.md` 与 [`OPEN_SOURCE_ECOSYSTEM.md`](./OPEN_SOURCE_ECOSYSTEM.md) 规范。
> **核心开发准则**：坚持**绝不重复造轮子**，在 GitHub 成熟开源项目（OpenClaw、DeepSeek Harness、Codex Harness）基础上进行二次开发与架构扩展，采用 **TypeScript Monorepo (pnpm workspace + Turborepo)** 架构高效推进。

---

## 阶段规划概览 (Milestones)

- [x] **M1: 基础工程与 Docker 沙箱隔离器 (Sandbox & Isolation Core)**
- [x] **M2: Agent 意图推导与自愈反思闭环 (Agentic Reproduction Loop)**
- [x] **M3: Probot GitHub App 网关与 ChatOps 调度 (Probot & Queue Gateway)**
- [ ] **M4: SQLite 审计落盘与状态可视化 (Persistence & Telemetry)**
- [ ] **M5: 生产容器化编排、录制 Demo 与开源发布 (Release & Open Source)**

---

## 详细实施任务分解 (Detailed Tasks)

### 阶段一：基础工程与 Docker 沙箱隔离器 (`packages/sandbox`)
> 目标：不依赖 GitHub 事件流，在本地单机能通过 Dockerode 启动受限沙箱，安全运行指定的 Python 脚本并捕获结果。

- [x] **Task 1.1: 初始化 Monorepo 脚手架**
  - 配置根目录 `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`
  - 初始化目录：`packages/shared`, `packages/sandbox`, `packages/core`, `apps/bot`
- [x] **Task 1.2: 实现公共数据契约 (`packages/shared`)**
  - 编写 Zod 模型：`ReproPlanSchema`, `ReflectionSchema`, `TaskStatusEnum`, `IssuePayloadSchema`
  - 导出对应 TypeScript 类型
- [x] **Task 1.3: 开发 Docker 沙箱隔离管理器 (`packages/sandbox`)**
  - 封装 `dockerode` 客户端与镜像自动拉取检测 (`python:3.11-slim`)
  - 注入安全隔离参数：`NetworkMode: "none"`, 限制 512MB RAM, 1 CPU, 只读挂载, 64MB tmpfs
  - 实现标准输出捕获器：提取 `exitCode`, `stdout`, `stderr`, 以及 30 秒硬超时熔断机制
- [x] **Task 1.4: 编写沙箱安全性单元测试**
  - 测试用例 1：执行死循环代码，验证 30 秒内被强制 kill 并安全回收容器
  - 测试用例 2：测试外网网络隔离（发起 `urllib.request` 请求，验证被网络隔离拦截）

---

### 阶段二：Agent 意图推导与自愈反思闭环 (`packages/core`)
> 目标：输入一段 Issue 文本和仓库路径，大模型自动生成最小测试脚本，并在沙箱中多轮自愈，直到成功触发业务 Bug。

- [x] **Task 2.1: 浅克隆与仓库预处理 (`packages/core/src/git.ts`)**
  - 基于原生 `child_process` 实现目标仓库最新 commit 的浅克隆 (`--depth 1`)
  - 自动定位仓库根目录与可导入的包名
- [x] **Task 2.2: 提示词工程与 Vercel AI SDK 接入 (`packages/core/src/prompt.ts`)**
  - 接入 DeepSeek-V3 / Qwen-2.5-Coder API (基于 Vercel AI SDK + OpenAI 兼容格式)
  - 编写系统提示词，强制模型基于 Zod Schema 输出结构化 `ReproPlan`（包含预期 `targetException` 与 `reproScript`）
- [x] **Task 2.3: 堆栈匹配与自愈反思状态机 (`packages/core/src/agent.ts`)**
  - 实现堆栈校验器：验证抛出的异常类名是否匹配，且堆栈是否溯源到仓库源码目录
  - 实现反思循环：若捕获 `ModuleNotFoundError` 或语法错误，将 stderr 反哺模型生成 `Reflection` 修补脚本（限制最多重试 3 轮）
- [x] **Task 2.4: 真实 Issue 本地基准测试 (Local Benchmark)**
  - 构造真实 Python Bug Issue 案例测试，验证从文本输入到自动成功复现的准确率与耗时

---

### 阶段三：Probot GitHub App 网关与 ChatOps 调度 (`apps/bot`)
> 目标：将核心引擎接驳到真实 GitHub 仓库中，支持维护者评论 `@repoclaw repro` 触发。

- [x] **Task 3.1: 初始化 Probot 应用程序**
  - 配置 GitHub App 密钥、App ID 与 Webhook Secret
  - 监听 `issue_comment.created` 事件
- [x] **Task 3.2: 权限与意图过滤网关**
  - 校验评论内容是否包含 `@repoclaw repro`（正则不区分大小写）
  - 校验评论者 `author_association`（必须为 OWNER / MEMBER / COLLABORATOR）
  - 鉴权通过后立即调用 Octokit 添加反应表情 👀 (Eyes)
- [x] **Task 3.3: 引入 BullMQ + Redis 异步削峰**
  - 配置 Redis 客户端与 BullMQ 任务队列，实现任务入队并返回 202 Accepted
  - 实现 Worker 消费线程，调用 `packages/core` 执行复现流水线
- [x] **Task 3.4: 结构化评论回写与标签流转**
  - 复现成功：调用 Octokit 为 Issue 添加 `reproduced` 标签，回帖精美的折叠代码块与真实堆栈，将表情更新为 🚀
  - 复现未果：发表友好说明，展示已尝试的脚本，引导提报者补充环境参数，将表情更新为 😕

---

### 阶段四：SQLite 审计落盘与状态可观测性 (`apps/bot/src/db`)
> 目标：记录每一次复现的完整生命周期，为后续扩展 Web 看板沉淀数据。

- [x] **Task 4.1: 初始化 Drizzle ORM 与 SQLite**
  - 编写 `reproTasks` 数据表定义与迁移脚本
  - 记录字段：任务 ID、仓库名、Issue 编号、触发者、最终状态、脚本、堆栈、耗时、重试轮数、Token 消耗
- [x] **Task 4.2: 状态机审计埋点接入**
  - 在任务入队、沙箱启动、重试、完成各节点插入生命周期审计日志

---

### 阶段五：生产容器化编排、录制 Demo 与开源发布
> 目标：单命令容器化上线，打磨顶级开源外观，发布 GitHub Marketplace。

- [x] **Task 5.1: 编写生产 `docker-compose.yml`**
  - 编排 Redis 服务与 RepoClaw Bot 服务，映射 Docker Socket 与 SQLite 数据卷
- [ ] **Task 5.2: 真实生产部署与 Webhook 联调**
  - 部署至 Linux 云服务器/重大实验室服务器，通过 Cloudflare Tunnel / 域名配置公开 Webhook URL
- [x] **Task 5.3: 开源门面与宣传物料**
  - 撰写中英文双语高 Star 门面 `README.md` 与 `README.en.md`，嵌入架构图、核心铁律与 ChatOps 执行示范
  - 提供 MIT 开源许可证与 GitHub App 接入指引
