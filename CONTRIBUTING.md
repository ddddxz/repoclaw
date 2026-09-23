# 🐾 RepoClaw 贡献者指南 (Contributing to RepoClaw)

非常感谢你对 **RepoClaw** 的关注与支持！RepoClaw 致力于为全球 GitHub 开源维护者打造自主复现 Bug 与合成测试用例的杀手级独立产品。

在提交 Issue 或发起 Pull Request 之前，请花费数分钟阅读本指南。

---

## 📜 社区原则与行为准则

所有参与 RepoClaw 项目的贡献者必须遵守开源社区规范与 [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)：
1. **代码精炼严谨**：优先复用经过安全审计的成熟方案，杜绝低质代码；
2. **零信任安全隔离**：任何沙箱与执行逻辑严格遵循断网、只读挂载与资源配额基线；
3. **专业严谨的工程态度**：保持清晰的代码注释与单元测试覆盖。

---

## 🛠️ 本地开发环境搭建 (Quick Start)

### 1. 前置依赖
- **Node.js**: `>= 20.0.0` (推荐 `22.x LTS`)
- **pnpm**: `9.15.4`
- **Docker**: 用于本地真实沙箱验证
- **Git**

### 2. 克隆代码与依赖安装
```bash
git clone https://github.com/ddddxz/repoclaw.git
cd repoclaw
pnpm install
```

### 3. 本地构建与全量测试
```bash
# 构建所有 Monorepo 子包
pnpm build

# 运行全量单元测试与 E2E 测试
pnpm test
```

### 4. 启动本地 Web 看板与 Probot 服务
```bash
cp .env.example .env
# 配置 .env 中的相关环境变量后：
pnpm dev
```
本地访问：
- 开发者官网：`http://localhost:3000/`
- 实时任务审计看板：`http://localhost:3000/dashboard`
- 健康检查：`http://localhost:3000/healthz`

---

## 📦 Monorepo 目录结构

```text
repoclaw/
├── apps/
│   └── bot/           # Probot GitHub App 网关、BullMQ 异步队列与 Web 看板
└── packages/
    ├── core/          # Agent 状态机、LLM 推导与 SWE-bench 堆栈比对
    ├── sandbox/       # Dockerode 受限沙箱隔离驱动与 Traceback 算法
    └── shared/        # 跨模块通用契约与 Zod Schema 规范
```

---

## 📝 Git 提交规范 (Conventional Commits)

所有 Git Commit 必须严格遵循 Conventional Commits 格式，提交信息**统一使用严谨中文**：

```text
<类型>(<影响模块>): <严谨中文描述>

# 示例：
feat(sandbox): 增加 PidsLimit 安全限制以防御 Fork 炸弹
fix(git): 修正浅克隆参数边界以防御参数注入
docs(readme): 更新 GitHub App 安装指引与架构图
test(e2e): 增加端到端闭环自动化测试用例
```

允许的提交类型：`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`。

---

## 🤝 提交 Pull Request 流程

1. Fork 本仓库并基于 `main` 分支拉取特性分支：`git checkout -b feat/my-cool-feature`；
2. 编写高质量代码，确保补齐单元测试或集成测试；
3. 本地运行 `pnpm test` 确保 100% 测试通过；
4. 提交规范 Commit 并推送到自己的远程仓库；
5. 向 `ddddxz/repoclaw:main` 发起 Pull Request；
6. 等待 CI 自动化构建与团队 Code Review。
