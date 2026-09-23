# ==========================================
# 阶段 1: 依赖构建阶段 (Builder)
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# 安装必要的构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 启用 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 复制依赖描述文件以利用 Docker 缓存层
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sandbox/package.json ./packages/sandbox/
COPY packages/core/package.json ./packages/core/
COPY apps/bot/package.json ./apps/bot/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制全量源代码
COPY . .

# 编译所有 Monorepo 模块
RUN pnpm -r build

# ==========================================
# 阶段 2: 生产运行阶段 (Runner)
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# 安装 Git (浅克隆目标仓库必备) 与 Docker CLI 基础客户端
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 从 builder 复制编译产物与 workspace 配置
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/sandbox ./packages/sandbox
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/bot ./apps/bot
COPY --from=builder /app/node_modules ./node_modules

# 创建持久化数据目录与沙箱临时目录
RUN mkdir -p /app/data /tmp/repoclaw

# 暴露 Probot HTTP 监听端口
EXPOSE 3000

WORKDIR /app/apps/bot

# 启动 Probot 服务
CMD ["node", "dist/index.js"]
