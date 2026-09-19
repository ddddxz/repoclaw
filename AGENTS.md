# RepoClaw 智能研发铁律与 Agent 指南 (AGENTS.md)

> 本文件是所有参与 RepoClaw 项目开发、维护与迭代的 AI Agent（包括 Antigravity、Claude Code、Cursor 等）的**最高行为准则与项目宪法**。在执行任何编码、设计或重构任务前，必须无条件遵循以下铁律。

---

## 核心铁律一：绝不重复造轮子，必须站在巨人的肩膀上 (Never Reinvent the Wheel)

1. **研发底座原则**：
   - 任何涉及通用基础设施的功能，**严禁从零手写**。
   - 必须优先调研并复用业界成熟、高星、经过安全审计的开源方案：
     - **GitHub App & 事件路由**：复用 `probot` / `@octokit/rest`，绝不手写 Webhook 验签与 OAuth 握手；
     - **异步队列与流量削峰**：复用 `bullmq` + `ioredis`，绝不自建内存队列；
     - **容器沙箱生命周期**：复用 `dockerode`，绝不手撕 Docker Engine HTTP API；
     - **模型推理与结构化解析**：复用 Vercel AI SDK (`ai`) 与 `zod`，绝不自研大模型流式调用层；
     - **本地持久化与数据迁移**：复用 `drizzle-orm` + `better-sqlite3`，绝不拼接原始 SQL；
     - **Python 堆栈解析算法**：复用并吸收 SWE-bench / Codex Harness 经过万级仓库检验的栈帧提取正则与自愈逻辑，绝不手写脆弱的字符串匹配。

2. **二开的真正含义**：
   - 优先通过 npm 包直接引入；
   - 次选吸收其经过工业级验证的核心算法与设计模式；
   - 严禁全盘盲目复制包含大量冗余 UI/无关代码的外部大仓库。

---

## 核心铁律二：面向全 GitHub 用户的独立杀手级产品，绝不做小众生态的附庸 (Universal Value Proposition)

1. **为什么开源项目能拿高 Star？**
   - **用户只会为“能解决自己切肤之痛”的产品点 Star，绝不会为一个用不上的冷门玩具插件点 Star**。
   - RepoClaw 的根本目标是**服务于全球所有 GitHub 仓库维护者与贡献者**，而不是沦为任何特定实验性 CLI 工具的从属配件。

2. **独立产品定位**：
   - **产品形态**：独立部署、开箱即用的 GitHub App（纯 ChatOps 交互：`@repoclaw repro`）；
   - **通用生态兼容**：无缝支持任何 Python 仓库（支持 `pyproject.toml`、`setup.py`、单文件模块），后续扩展 Node/Go/Rust；
   - **极低使用门槛**：提供 `docker-compose.yml` 单命令启动，支持连接任何 OpenAI 兼容模型（DeepSeek、Qwen、Claude、GPT）。

---

## 核心铁律三：零信任受限沙箱与极致安全性 (Zero-Trust Sandbox Security)

1. 任何来自 Issue 的不受信任输入，必须在受限容器内执行；
2. 绝对断网（`NetworkMode: "none"`）、只读代码挂载（`:ro`）、64MB 临时 tmpfs、30 秒硬超时 SIGKILL 强杀；
3. 容器内严格使用降权非 root 用户（`User: "1000:1000"`），彻底消除逃逸隐患。

---

## 核心铁律四：统一使用专业规范的中文进行 Git 与文档管理

1. 所有 Git Commit 必须使用 Conventional Commits 规范，提交说明**统一使用严谨中文**；
2. 所有核心文档（PRD、TECH_SPEC、architecture、task）与代码核心注释统一使用中文编写；
3. 保持工作区整洁，提交前确保 100% 通过自动化单元测试。
