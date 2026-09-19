<div align="center">

<img src="./apps/bot/public/images/logo.jpg" width="120" alt="RepoClaw Logo" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,242,254,0.3);" />

# 🐾 RepoClaw

**面向全球 GitHub 维护者的自主 Bug 复现与最小用例合成数字维护者**  
*Autonomous GitHub Issue Reproducer & Minimal Test Synthesizer*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node.js-22%20LTS-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/docker-zero--trust%20sandbox-2496ED.svg)](https://www.docker.com/)
[![GitHub App](https://img.shields.io/badge/github--app-Probot%2013-black.svg)](https://probot.github.io/)
[![Install RepoClaw](https://img.shields.io/badge/Install%20on-GitHub%20App-2ea44f?style=flat&logo=github)](https://github.com/apps/repoclaw-app)
[![Web Dashboard](https://img.shields.io/badge/dashboard-live%20observability-9d4edd.svg)](http://localhost:3000/dashboard)

[English](./README.en.md) | **简体中文**

</div>

---

## 💡 为什么需要 RepoClaw？(The Pain Point)

在全球开源软件生态中，维护者每天面临的最大痛点之一就是**堆积如山的 Bug 报告**：
- **痛点 1：描述含糊、缺失环境**：超过 60% 的 Issue 仅包含一段零散报错文本或截图，未提供可独立运行的复现代码；
- **痛点 2：人力沟通成本极高**：维护者不得不反复追问 *"Can you provide a minimal reproduction script?"*，往往耗费数天乃至数周；
- **痛点 3：复现耗时长**：维护者手动拉代码、配依赖、尝试复现，平均每个 Bug 耗时 20 ~ 45 分钟。

**RepoClaw 为终结此痛点而生**。它是一个开箱即用的独立 GitHub App，作为智能“数字维护者”常驻仓库。维护者只需在 Issue 评论区输入一行 ChatOps 指令：

```markdown
@repoclaw repro
```

**RepoClaw 会立即接管：**
1. **< 1.5s 极速响应**：自动给评论添加 👀 反应，告知已入队；
2. **零信任容器隔离**：拉起绝对断网（`NetworkMode: none`）、只读挂载（`:ro`）、30秒硬熔断的轻量 Docker 容器；
3. **Agent 自愈反思推导**：基于大模型提取错误特征，推导复现计划，若报错不符则捕获真实堆栈并自动进行最多 3 轮变异反思（借鉴 SWE-bench / DeepSeek Harness 状态机闭环）；
4. **自动化回写与打标**：成功复现后，自动为 Issue 打上 `[reproduced]` 标签，发表精美的折叠测试脚本与堆栈报告，并将评论反应升级为 🚀！

---

## 🎬 交互效果演示 (ChatOps in Action)

### 1. 触发指令 (Maintainer)
```text
@repoclaw repro 请协助复现该除零异常
```

### 2. 即时响应 (RepoClaw Gateway)
> RepoClaw 鉴权维护者身份（`OWNER` / `MEMBER` / `COLLABORATOR`），拦截非授权用户以防 Token 盗刷，并在 1.5 秒内添加 👀 表情并压入 BullMQ 异步队列。

### 3. 自动验证回帖 (RepoClaw Bot)
> 复现成功后，Issue 被自动打上 `reproduced` 标签，评论表情更新为 🚀，并发表如下结构化回帖：

<details open>
<summary><b>🤖 RepoClaw 自动化 Bug 复现报告 (Verified)</b></summary>

### 🎯 复现状态总结
- **目标异常类型**：`ZeroDivisionError`
- **复现判定**：✅ **成功捕获并确认目标异常**
- **自愈反思轮次**：1 轮
- **总耗时**：3,420 ms

### 💻 最小独立复现脚本 (`repro.py`)
```python
import sys
sys.path.insert(0, '/workspace')
from my_package.calculator import calculate

# 触发除零异常
calculate(10, 0)
```

<details>
<summary><b>🔍 查看容器沙箱捕获的真实 Traceback 堆栈</b></summary>

```text
Traceback (most recent call last):
  File "/scratch/repro.py", line 6, in <module>
    calculate(10, 0)
  File "/workspace/my_package/calculator.py", line 4, in calculate
    return a / b
ZeroDivisionError: division by zero
```
</details>

---
*由 [RepoClaw](https://github.com/your-org/repoclaw) 自动化安全沙箱自主合成与验证*
</details>

---

## 🏛️ 系统架构 (Architecture)

```mermaid
flowchart TD
    User([GitHub 维护者]) -->|@repoclaw repro| Webhook[GitHub Webhook Gateway]
    Webhook --> Auth{鉴权网关: OWNER / MEMBER / COLLABORATOR}
    
    Auth -->|未授权| Deny[回帖拦截警示并阻断]
    Auth -->|鉴权通过| Feedback[< 1.5s 立即添加 👀 表情]
    
    Feedback --> Queue[(BullMQ + Redis 异步削峰队列)]
    
    subgraph Worker [RepoClaw 异步消费服务]
        Queue --> Consumer[Worker 消费进程]
        Consumer --> GitClone[极速 Shallow 克隆目标仓库]
        Consumer --> Core[Agent 自愈反思状态机]
        
        subgraph Sandbox [零信任受限 Docker 沙箱]
            Core --> Runner[Dockerode 沙箱执行器]
            Runner --> Container["python:3.11-slim (断网 / 只读挂载 / 30s 硬熔断)"]
        end
        
        Container --> Matcher[Traceback 堆栈抽取与语义正则匹配]
        Matcher -->|未达标且可重试| Core
        Matcher -->|复现成功 / 达到上限| Octokit[GitHub Octokit 回写]
    end
    
    Octokit --> Done[回帖最小用例 + 打标 reproduced + 贴 🚀]
    Consumer --> DB[(SQLite + Drizzle ORM 审计持久化)]
```

---

## 🌐 内置开发者官网与实时任务审计看板 (Web Dashboard)

除了 GitHub 原生评论区的 ChatOps 交互外，RepoClaw 原生内置了极具未来科技感与暗黑磨砂玻璃美学的 Web 站点，由 Probot Express 服务同端口原生托管，零额外运维开销：

- **开发者门户官网 (`http://localhost:3000/`)**：包含品牌主视觉、核心架构全景图、ChatOps 交互指引与“⚡ Install to GitHub”一键安装按钮；
- **实时任务审计看板 (`http://localhost:3000/dashboard`)**：
  - **4 大全局 KPI**：总任务数、复现成功率（Verified Rate）、平均耗时、累计自愈反思轮次；
  - **实时流水表格**：支持按仓库名动态筛选，展示当前运行状态色彩徽章；
  - **交互式详情弹窗**：点击任务即可查看**最小复现脚本（含一键复制）**、**真实 Traceback 堆栈**以及**状态机全生命周期审计流水时间线**。

---

## 🛡️ 核心研发铁律：站在巨人的肩膀上 (Never Reinvent the Wheel)

RepoClaw 坚定践行**开源组件最大化复用原则**，拒绝闭门造车：

| 模块职能 | 成熟开源方案 | 选型与复用依据 |
| :--- | :--- | :--- |
| **Webhook 路由与鉴权** | `probot` + `@octokit/rest` | 官方工业级 GitHub App 框架，自带签名校验、密钥轮换与幂等机制 |
| **异步队列与流量削峰** | `bullmq` + `ioredis` | 高性能 Redis 队列，原生支持重试退避、失败告警与持久化 |
| **容器沙箱生命周期** | `dockerode` | 深度接管 Docker Engine API，实现微秒级容器创建、流式输出与强杀 |
| **LLM 结构化推导** | Vercel AI SDK (`ai`) + `zod` | 业界最先进的声明式模型调用层，原生支持 OpenAI 兼容格式 (DeepSeek, Qwen) |
| **本地持久化与审计** | `drizzle-orm` + `@libsql/client` | 极速轻量 TypeScript ORM，支持内存/文件双模与零 C++ 编译运行 |
| **自愈反思算法哲学** | `SWE-bench` / `Codex Harness` | 吸收其经过数万开源仓库检验的 Traceback 栈帧提取正则与变异自愈状态机 |

---

## 🔒 零信任沙箱安全性 (Zero-Trust Security)

运行来自 GitHub Issue 的代码具有高度风险，RepoClaw 实施了防御纵深的安全策略：

1. **绝对网络隔离**：容器指定 `NetworkMode: "none"`，彻底杜绝数据外逸、木马下载或 SSRF 攻击；
2. **代码只读挂载**：目标仓库代码以 `:ro` (Read-Only) 挂载，容器绝无法篡改原工程代码；
3. **独立运行目录**：复现脚本写入 64MB 临时 `tmpfs` 内存卷中，容器销毁即彻底清除；
4. **硬性超时强杀**：沙箱限定 30 秒硬超时，一旦超时通过内核 `SIGKILL (Kill -9)` 强制终止；
5. **降权用户运行**：容器默认以 `User: "1000:1000"` 非 root 身份启动，彻底防御容器逃逸。

---

## 🚀 5 分钟快速启动 (Quick Start)

### 1. 克隆代码与准备环境
```bash
git clone https://github.com/your-org/repoclaw.git
cd repoclaw

# 复制环境变量模板
cp .env.example .env
```

### 2. 配置 `.env`
在 `.env` 中填写您的 GitHub App 与大模型配置：
```ini
# GitHub App (从 https://github.com/settings/apps 获取)
APP_ID=your_app_id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
WEBHOOK_SECRET=your_webhook_secret

# 模型 API Key (支持 DeepSeek, Qwen, Claude, GPT)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
MODEL_NAME=deepseek-chat
```

### 3. 使用 Docker Compose 一键拉起
```bash
docker compose up -d
```

服务启动后：
- **Bot 网关**：监听在 `http://localhost:3000`；
- **Redis 队列**：监听在 `localhost:6379`；
- **SQLite 数据文件**：持久化保存在 `./data/repoclaw.db`。

---

## 🛠️ 本地开发与单元测试

本项目采用 **pnpm workspace + Turborepo** Monorepo 结构：

```bash
# 1. 安装项目依赖
pnpm install

# 2. 全量编译
pnpm -r build

# 3. 运行全工作区单元测试 (覆盖核心沙箱安全、Agent 状态机、Probot 网关与持久化)
pnpm -r test
```

> **测试覆盖**：项目内置 42 项自动化测试，包括防逃逸参数校验、堆栈匹配算法、ChatOps 角色拦截、双模 Mock 沙箱与 Drizzle ORM 持久化，无需外部依赖即可 100% 离线通过。

---

## 🗺️ 项目路线图 (Roadmap)

- [x] **Milestone 1**: 数据契约 (`@repoclaw/shared`) 与 Docker 零信任安全隔离器 (`@repoclaw/sandbox`)
- [x] **Milestone 2**: Agent 意图推导与状态机自愈反思闭环 (`@repoclaw/core`)
- [x] **Milestone 3**: Probot GitHub App 网关、ChatOps 指令解析与 BullMQ 异步削峰 (`apps/bot`)
- [x] **Milestone 4**: 基于 Drizzle ORM + LibSQL 的任务生命周期审计与持久化 (`apps/bot/src/db`)
- [x] **Milestone 5**: 生产 `docker-compose.yml` 编排、多阶段 `Dockerfile` 与开源发布
- [ ] **Next**: 扩展对 JavaScript/TypeScript (Jest/Vitest)、Golang 及 Rust 仓库的原生支持
- [ ] **Next**: Web 状态观测看板（任务重试耗时、Token 消耗分布与复现成功率）

---

## 📄 开源许可证 (License)

本项目遵循 [MIT License](./LICENSE) 开放源代码。
