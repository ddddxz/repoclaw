# RepoClaw 技术架构与规范设计书 (Technical Specification)

| 文档版本 | 状态 | 规范标准 |
| :--- | :--- | :--- |
| **v1.0.0** | 评审已通过 (Approved) | TypeScript / Node.js 20+ ESM |

---

## 1. 技术栈全景与选型裁定 (Tech Stack Matrix)

| 层次/功能 | 选用技术 | 选型原因与技术裁定 |
| :--- | :--- | :--- |
| **开发语言与运行时** | **TypeScript 5.x / Node.js 22 LTS (ESM)** | 全栈统一心智，现代异步 I/O 事件循环，强类型保障 |
| **Monorepo 架构** | **pnpm workspace + Turborepo** | 极速依赖链接，模块解耦，前后端公共包共享 |
| **GitHub App 接入** | **Probot 13.x** | GitHub 官方标配框架，内置 Webhook 验签与 Octokit 鉴权 |
| **任务队列与削峰** | **BullMQ 5.x + ioredis** | Node.js 生态最高性能分布式队列，支持重试、延迟与速率限制 |
| **持久化与 ORM** | **SQLite 3 + Drizzle ORM** | 零外部依赖、轻量单文件落盘，单容器 Docker 一键自托管 |
| **大模型推理引擎** | **Vercel AI SDK (`ai`)** | 统一流式与结构化输出接口，对标工业级 Agent 标准 |
| **数据校验与 Schema** | **Zod 3.x** | 运行时与编译时类型双重对齐，大模型输出 100% 结构化 |
| **容器沙箱管理** | **Dockerode 4.x** | 基于 Node.js Promise 的 Docker Engine API 封装 |

---

## 2. Monorepo 工程目录结构规划 (Repository Structure)

```text
repoclaw/
├── .gitignore
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── docker-compose.yml
├── docs/
│   ├── PRD.md
│   ├── TECH_SPEC.md
│   ├── architecture.md
│   └── task.md
├── packages/
│   ├── shared/                # 公共契约与类型定义
│   │   ├── src/
│   │   │   ├── schemas/       # Zod 数据模型定义
│   │   │   │   ├── issue.ts
│   │   │   │   └── repro.ts
│   │   │   └── types/         # TypeScript 全局接口
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── sandbox/               # Docker 沙箱执行器
│   │   ├── src/
│   │   │   ├── docker.ts      # Dockerode 客户端包装
│   │   │   ├── runner.ts      # 隔离运行生命周期控制
│   │   │   └── security.ts    # cgroups 与安全参数校验
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── core/                  # Agent 推理与自愈反思核心
│       ├── src/
│       │   ├── agent.ts       # 状态机主控制器
│       │   ├── prompt.ts      # 系统提示词工程
│       │   ├── matcher.ts     # 异常特征与堆栈对齐机
│       │   └── git.ts         # 浅克隆与代码预加载
│       ├── package.json
│       └── tsconfig.json
└── apps/
    └── bot/                   # GitHub App 服务端进程
        ├── src/
        │   ├── index.ts       # Probot 入口与事件监听
        │   ├── worker.ts      # BullMQ 任务消费处理进程
        │   ├── db/            # Drizzle ORM 与 SQLite 初始化
        │   │   ├── schema.ts
        │   │   └── index.ts
        │   └── handlers/      # 评论触发与回帖逻辑
        │       └── comment.ts
        ├── package.json
        └── tsconfig.json
```

---

## 3. 数据契约与 Zod 模型定义 (Data Contracts)

### 3.1 大模型生成意图与脚本模型 (`ReproPlanSchema`)
```typescript
import { z } from "zod";

export const ReproPlanSchema = z.object({
  targetException: z.string().describe("预期的核心报错类型，如 ZeroDivisionError, ValueError, KeyError"),
  errorKeywords: z.array(z.string()).describe("预期堆栈中必须包含的关键词列表"),
  reproScript: z.string().describe("完整的、可独立运行的 Python 复现脚本代码（使用标准库或目标仓库自身模块）"),
  explanation: z.string().describe("该复现脚本的构造原理与触发意图简要说明"),
});

export type ReproPlan = z.infer<typeof ReproPlanSchema>;
```

### 3.2 自愈反思修补模型 (`ReflectionSchema`)
```typescript
export const ReflectionSchema = z.object({
  analysis: z.string().describe("分析为何上一轮脚本未成功触发目标 Bug（如：模块路径错误、入参未达到边界条件）"),
  actionType: z.enum(["PATCH_IMPORTS", "MUTATE_INPUTS", "ABORT"]).describe("采取的修复动作类别"),
  patchedScript: z.string().describe("修复后的最新完整复现脚本"),
});

export type Reflection = z.infer<typeof ReflectionSchema>;
```

### 3.3 任务状态与执行生命周期模型 (`TaskStatusSchema`)
```typescript
// 持久化到 SQLite 的主状态 (与 DB 字段严格对应)
export const TaskStatusEnum = z.enum([
  "PENDING",      // 任务已入队，等待调度消费
  "RUNNING",      // 任务正在执行 (克隆代码/生成脚本/沙箱运行)
  "VERIFIED",     // 成功捕获目标异常并验证
  "UNVERIFIED",   // 执行正常退出或变异后仍未触发目标异常
  "FAILED",       // 语法/模块错误重试超限，或超时强杀
]);

export type TaskStatus = z.infer<typeof TaskStatusEnum>;

// 细粒度状态机执行步骤 (用于可观测性与日志埋点)
export const TaskStepEnum = z.enum([
  "INIT",
  "CLONING",
  "GENERATING",
  "SANDBOX_RUN",
  "REFLECTING",
  "GITHUB_NOTIFY",
]);

export type TaskStep = z.infer<typeof TaskStepEnum>;
```

### 3.4 GitHub ChatOps 触发载荷契约 (`IssuePayloadSchema`)
```typescript
export const IssuePayloadSchema = z.object({
  id: z.string().uuid().describe("任务唯一跟踪 ID (UUIDv4)"),
  repoFullName: z.string().describe("目标仓库全名 (如 owner/repo)"),
  repoCloneUrl: z.string().url().describe("仓库克隆地址"),
  issueNumber: z.number().int().positive().describe("Issue 序号"),
  issueTitle: z.string().describe("Issue 标题"),
  issueBody: z.string().describe("Issue 原始提报文本与代码块"),
  commentId: z.number().int().positive().describe("触发指令的评论 ID"),
  triggerUser: z.string().describe("发起 ChatOps 指令的维护者用户名"),
  authorAssociation: z.enum(["OWNER", "MEMBER", "COLLABORATOR"]).describe("触发者权限角色"),
});

export type IssuePayload = z.infer<typeof IssuePayloadSchema>;
```

---

## 4. 沙箱容器安全与隔离规范 (Dockerode Security Parameters)

在 `packages/sandbox` 中创建隔离容器时，强制注入以下安全约束：

```typescript
// Docker 容器硬安全配置定义
export const SANDBOX_DOCKER_CONFIG = {
  Image: "python:3.11-slim",
  Tty: false,
  OpenStdin: false,
  HostConfig: {
    // 1. 网络绝对断网，杜绝反弹 Shell 与挖矿
    NetworkMode: "none",
    
    // 2. 严格的 cgroups 资源限制
    Memory: 512 * 1024 * 1024,      // 限制 512MB 内存
    MemorySwap: 512 * 1024 * 1024,  // 禁止使用 Swap，防内存击穿
    NanoCpus: 1000000000,          // 限制 1.0 个 CPU 核心
    
    // 3. 根文件系统只读挂载
    ReadonlyRootfs: true,
    
    // 4. 挂载 64MB tmpfs 内存盘供脚本写入与执行
    Tmpfs: {
      "/tmp": "rw,noexec,nosuid,size=64m",
      "/scratch": "rw,exec,nosuid,size=64m",
    },
    
    // 5. 目标仓库代码目录以只读挂载
    Binds: [
      `${hostRepoDir}:/workspace:ro`,
    ],
  },
  // 6. 降权执行用户，杜绝 root 权限提权
  User: "1000:1000",
  WorkingDir: "/scratch",
  Cmd: ["python", "/scratch/repro.py"],
};
```

---

## 5. 数据库持久化表设计 (SQLite via Drizzle ORM)

在 `apps/bot/src/db/schema.ts` 中定义任务审计表：

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const reproTasks = sqliteTable("repro_tasks", {
  id: text("id").primaryKey(),                       // UUID
  repoFullName: text("repo_full_name").notNull(),     // e.g. "facebook/react"
  issueNumber: integer("issue_number").notNull(),     // e.g. 1024
  triggerUser: text("trigger_user").notNull(),        // e.g. "octocat"
  status: text("status", { enum: ["PENDING", "RUNNING", "VERIFIED", "UNVERIFIED", "FAILED"] }).notNull(),
  
  targetException: text("target_exception"),          // 预期异常名
  reproScript: text("repro_script"),                  // 最终复现脚本
  actualTraceback: text("actual_traceback"),          // 真实捕获的堆栈
  retryCount: integer("retry_count").default(0),      // 自愈反思轮数
  
  durationMs: integer("duration_ms"),                 // 全流程耗时 (毫秒)
  tokenUsage: integer("token_usage"),                 // 消耗的总 Token 数
  
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
});
```

---

## 6. 自愈反思状态机工作流 (State Machine)

```
[INIT] 任务入队
  │
  ▼
[CLONING] 浅克隆仓库 HEAD (耗时 < 3s)
  │
  ▼
[GENERATING] LLM 生成 ReproPlan (首选零冗余单文件)
  │
  ▼
[SANDBOX_RUN] Docker 隔离执行 (限制 30s)
  │
  ├── Exit 0 (未触发异常) ──► 变异入参重新执行 (仅1次) ──► 若仍 Exit 0 ──► [UNVERIFIED]
  │
  ├── Exit != 0
  │     ├── 捕获到目标 TargetException + 源码行号 ──► [VERIFIED 成功]
  │     └── 报 SyntaxError / ModuleNotFoundError
  │           │
  │           ├── retryCount < 3 ──► 反哺错误堆栈，生成 PatchedScript ──► [SANDBOX_RUN]
  │           └── retryCount >= 3 ──► [FAILED 失败]
  ▼
[GITHUB_NOTIFY] 回写 GitHub 评论并打标 [reproduced]
```
