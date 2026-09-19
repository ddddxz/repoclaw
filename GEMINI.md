# GEMINI 项目级指令与最高铁律

> 详见项目最高规范文件：[AGENTS.md](./AGENTS.md)

1. **绝不重复造轮子**：通用基础设施（队列 BullMQ、容器 Dockerode、鉴权 Probot、LLM流式 Vercel AI SDK、ORM Drizzle）一律基于成熟开源方案，严禁从零造轮子。
2. **面向全 GitHub 用户的独立杀手级产品**：服务全 GitHub 开源维护者，解决 Bug 复现成本极高的核心痛点，做真正能帮人省时提效的高 Star 独立产品。
3. **安全沙箱绝对隔离**：只读挂载、断网隔离、30s 熔断。
4. **Git 与文档统一中文规范**。
