# RepoClaw 系统架构与设计说明书

## 1. 系统概述 (System Overview)
**RepoClaw** 是一个面向 GitHub 开源仓库的自主 Bug 复现与最小用例合成数字维护者（Autonomous Issue Reproducer & Test Synthesizer）。
系统基于 **TypeScript / Node.js** 全栈生态构建，以 **GitHub App (Probot)** 形式常驻运行。当开源仓库维护者在 Issue 评论区通过 ChatOps 指令（如 `@repoclaw repro`）显式触发时，系统通过严格权限校验后自动拉起受限隔离的 Docker 容器沙箱，依托大模型驱动的 Agentic 确定性反馈自愈闭环，自主分析 Issue 意图、合成最小独立复现脚本、在沙箱中执行并验证报错堆栈，最终在 GitHub 对应 Issue 评论区结构化回写复现代码与 Traceback，并自动打上 `reproduced` 状态标签。

---

## 2. 系统用例图 (Use Case Diagram)

```mermaid
flowchart LR
    subgraph Users ["参与角色 (Actors)"]
        Reporter["外部贡献者/用户 (Issue Reporter)"]
        Maintainer["开源项目维护者 (Maintainer)"]
    end

    subgraph GitHub ["GitHub 平台"]
        GH_Issue["Issue 事件流"]
        GH_Comment["Issue 评论区与标签"]
    end

    subgraph RepoClaw ["RepoClaw 系统用例"]
        UC1(["提报包含 Bug 描述的 Issue"])
        UC2(["手动触发复现 (@repoclaw repro)"])
        UC3(["自动提取错误特征与环境意图"])
        UC4(["动态拉起安全受限沙箱 (Docker)"])
        UC5(["合成最小独立复现脚本 (repro.py)"])
        UC6(["执行测试并捕获 Traceback"])
        UC7(["Agent 自愈反思重试 (Reflection Loop)"])
        UC8(["回贴已验证凭据与自动打标 [reproduced]"])
        UC9(["礼貌追问缺失的关键复现环境"])
        UC10(["查看系统执行监控看板 (Dashboard)"])
    end

    Reporter --> UC1
    UC1 --> GH_Issue
    GH_Issue -.->|审阅待复现 Issue| Maintainer

    Maintainer --> UC2
    UC2 --> GH_Comment
    GH_Comment -->|Webhook: issue_comment.created (权限校验通过)| UC3
    Maintainer --> UC10

    UC3 --> UC4
    UC4 --> UC5
    UC5 --> UC6
    UC6 --> UC7
    
    UC7 -->|复现成功| UC8
    UC7 -->|多次重试失败| UC9

    UC8 --> GH_Comment
    UC9 --> GH_Comment
    GH_Comment --> Reporter
    GH_Comment --> Maintainer
```

---

## 3. 系统分层架构图 (System Architecture Diagram)

```mermaid
flowchart TD
    subgraph External ["外部交互层 (External Layer)"]
        UserBrowser["用户浏览器 / 管理员看板"]
        GitHubPlatform["GitHub API & Webhook"]
    end

    subgraph Gateway ["接入与路由层 (Gateway Layer)"]
        ProbotApp["Probot GitHub App 网关"]
        SignatureGuard["Webhook 签名鉴权与防重放 (HMAC-SHA256)"]
        EventRouter["ChatOps 事件路由器 (issue_comment.created 过滤与指令匹配)"]
    end

    subgraph Queue ["异步调度与缓冲层 (Queue Layer)"]
        RedisServer[("Redis 7.x 缓存与持久化")]
        BullMQueue["BullMQ 分布式异步任务队列"]
        RateLimiter["租户与仓库级并发限流器 (Rate Limiter)"]
    end

    subgraph AgentCore ["Agent 推理与反思核心 (Agent Core)"]
        WorkerScheduler["任务调度 Worker (TypeScript)"]
        PromptEngine["Prompt 模板与上下文抽取引擎"]
        ZodValidator["Zod 强类型校验与结构化解析"]
        LLMProvider["大模型驱动 (Vercel AI SDK -> DeepSeek-V3 / Qwen-Coder)"]
        ReflectionController["自愈反思控制器 (Max 3 Loops)"]
    end

    subgraph SandboxPool ["安全隔离沙箱池 (Sandbox Execution Pool)"]
        DockerodeMgr["Dockerode 容器生命周期管理器"]
        cgroupsGuard["cgroups 资源熔断 (512MB RAM, 1 CPU, 30s Timeout)"]
        NetworkIsolated["网络隔离策略 (--network none)"]
        EphemeralContainers["轻量只读沙箱容器 (python:3.11-slim, V2.0 规划扩展多语言)"]
    end

    subgraph StorageTelemetry ["存储与可观测层 (Telemetry Layer)"]
        SQLiteDB[("SQLite 审计与运行记录库")]
        LoggerEngine["结构化日志与追踪 (Pino Logger)"]
    end

    GitHubPlatform -->|Webhook POST| SignatureGuard
    SignatureGuard --> ProbotApp
    ProbotApp --> EventRouter
    EventRouter --> RateLimiter
    RateLimiter --> BullMQueue
    BullMQueue <--> RedisServer

    BullMQueue --> WorkerScheduler
    WorkerScheduler --> PromptEngine
    PromptEngine --> LLMProvider
    LLMProvider --> ZodValidator
    ZodValidator --> ReflectionController

    ReflectionController --> DockerodeMgr
    DockerodeMgr --> cgroupsGuard
    cgroupsGuard --> NetworkIsolated
    NetworkIsolated --> EphemeralContainers

    EphemeralContainers -->|返回 Exit Code & stderr| ReflectionController
    ReflectionController -->|复现结果持久化| SQLiteDB
    WorkerScheduler -->|调用 Octokit 回写评论与标签| GitHubPlatform

    UserBrowser -->|查询实时运行状态| ProbotApp
    WorkerScheduler --> LoggerEngine
```

---

## 4. 端到端执行时序流程图 (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Reporter as Issue 提交者
    participant GH as GitHub 平台
    actor Maintainer as 仓库维护者
    participant Gateway as RepoClaw 网关 (Probot)
    participant Queue as 任务队列 (BullMQ/Redis)
    participant Worker as Agent 调度 Worker
    participant LLM as 大模型 (DeepSeek-V3)
    participant Sandbox as Docker 隔离沙箱

    Reporter->>GH: 提交 Bug Issue (包含现象与报错描述)
    Maintainer->>GH: 审阅 Issue 并发表评论触发: @repoclaw repro
    GH->>Gateway: Webhook 推送 issue_comment.created 事件
    Gateway->>Gateway: 验签 (verifySignature) & 鉴权 (OWNER / MEMBER / COLLABORATOR)
    alt 鉴权失败或无触发指令
        Gateway-->>GH: 静默忽略或提示仅项目维护者可触发
    else 鉴权成功且指令匹配
        Gateway->>GH: 调用 Reactions API 添加表情 👀 (Eyes: 表示正在排队处理)
        Gateway->>Queue: 压入复现任务 (Payload: repo, issueNumber, commentId, triggerUser)
        Gateway-->>GH: 立即响应 202 Accepted
    end
    
    Queue->>Worker: 消费并调度任务
    Worker->>Worker: 浅克隆目标仓库 HEAD 分支 (耗时 < 3s, :ro 只读挂载)
    Worker->>LLM: 提示词注入: Issue 标题+内容+仓库上下文 (Vercel AI SDK)
    LLM-->>Worker: 结构化输出 ReproPlan: 目标异常名(TargetError) + 最小复现脚本(repro.py)
    
    Worker->>Sandbox: 动态拉起沙箱 (无外网, 限制 512MB 内存, 30s 超时)
    Worker->>Sandbox: 注入 repro.py 并执行: `python repro.py`
    Sandbox-->>Worker: 返回 Exit Code 与 stderr 输出
    
    rect rgb(240, 248, 255)
    note over Worker, Sandbox: 自愈反思循环 (Reflection Loop, 最多重试 3 次)
    alt 执行报语法/模块错误 (SyntaxError / ModuleNotFoundError)
        Worker->>LLM: 携带错误堆栈反哺模型，生成 Reflection 修补脚本
        LLM-->>Worker: 返回修正后的 repro.py
        Worker->>Sandbox: 重新在隔离沙箱中执行
        Sandbox-->>Worker: 返回最新执行结果
    end
    end

    alt 成功触发目标异常 (Verified)
        Worker->>GH: 自动发表 Comment (附带独立可复现代码 + 捕获的堆栈 Traceback)
        Worker->>GH: 自动给 Issue 打上标签: [reproduced]
        Worker->>GH: 更新评论反应为 🚀 (Rocket)
        GH-->>Reporter: 通知 Issue 已成功验证
        GH-->>Maintainer: 通知有确切的最小用例可供直接修复
    else 达到最大重试次数仍未复现
        Worker->>GH: 发表礼貌回复 (附带尝试运行的用例，提示补充版本/输入细节)
        Worker->>GH: 更新评论反应为 😕 (Confused)
    end
    
    Worker->>Sandbox: 强制销毁临时容器释放资源
    Worker->>Queue: 标记任务完成 (ACK)
```

---

## 5. 沙箱安全与防穿透规范 (Security & Blast-Radius Control)

在运行任意不受信任的 Issue 代码时，系统遵循最高级别安全隔离准则：
1. **网络绝对隔离 (`NetworkMode: "none"`)**：默认禁止一切外网访问，杜绝反弹 Shell、对外扫描或下载恶意挖矿二进制。
2. **只读挂载与临时层 (`ReadonlyRootfs + tmpfs`)**：容器根文件系统只读，仅为执行脚本挂载 64MB 的内存临时目录，脚本结束后瞬间释放。
3. **严格的资源配额 (cgroups Limits)**：
   - 内存上限：512MB（防内存耗尽攻击 OOM）
   - CPU 核心上限：1.0 核
   - 执行硬性超时：30 秒，超时直接 `SIGKILL`
4. **降权用户运行 (`User: "1000:1000"` / 非 root 专用受限用户)**：容器内禁止使用 root 身份执行任何脚本，与 `TECH_SPEC.md` 沙箱硬安全约束统一，彻底消除特权逃逸风险。
