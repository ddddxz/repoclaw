import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inspectRepo, ReproAgent, MockLlmProvider } from "../src/index.js";
import { MockSandboxRunner } from "@repoclaw/sandbox";

describe("真实大型开源工程实战复现测试 (NousResearch/hermes-agent)", () => {
  it("实战场景: 针对真实 Hermes-Agent Issue #120831 进行 AST 符号抽取与闭环复现", async () => {
    // 优先检查本地是否下载了完整 Hermes 仓库，若在 CI 环境中则自适应生成等价工程架构
    const localHermesPath = "C:/Users/31779/AppData/Local/Temp/hermes-agent-root/hermes-agent-main";
    const hasLocalHermes = await fs
      .stat(localHermesPath)
      .then((s) => s.isDirectory())
      .catch(() => false);

    let repoDir = localHermesPath;
    let tempDirToClean: string | null = null;

    if (!hasLocalHermes) {
      // 在云端 CI (如 GitHub Actions Ubuntu 虚拟机) 环境中自适应构造真实的工程拓扑
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-hermes-agent-"));
      tempDirToClean = tempDir;

      // 建立包结构
      await fs.mkdir(path.join(tempDir, "gateway", "platforms"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "tools"), { recursive: true });
      await fs.mkdir(path.join(tempDir, "agent"), { recursive: true });

      // 写入真实的 api_server.py 关键代码
      await fs.writeFile(
        path.join(tempDir, "gateway", "platforms", "api_server.py"),
        `import logging
logger = logging.getLogger(__name__)

class APIServerAdapter:
    async def _handle_skills(self, request):
        from tools.skills_tool import _find_all_skills, _sort_skills
        return _sort_skills(
            _find_all_skills(skip_disabled=False, include_editorial=True)
        )
`
      );

      // 写入真实的 skills_tool.py 签名
      await fs.writeFile(
        path.join(tempDir, "tools", "skills_tool.py"),
        `from typing import List, Dict, Any

def _find_all_skills(*, skip_disabled: bool = False) -> List[Dict[str, Any]]:
    return []

def _sort_skills(skills):
    return skills
`
      );

      await fs.writeFile(path.join(tempDir, "agent", "skill_utils.py"), "# agent utilities\n");
      await fs.writeFile(path.join(tempDir, "pyproject.toml"), "[project]\nname='hermes-agent'\n");

      repoDir = tempDir;
    }

    try {
      // 1. 检验工程结构探测与 AST 模块切片能力
      const keywords = ["skills", "api_server", "_find_all_skills", "include_editorial"];
      const meta = await inspectRepo(repoDir, keywords);

      expect(meta.language).toBe("python");
      expect(meta.packageNames).toContain("gateway");
      expect(meta.packageNames).toContain("agent");
      expect(meta.astOutlines).toBeDefined();
      expect(meta.astOutlines!.length).toBeGreaterThan(0);

      // 确认成功命中了出问题的真实文件 gateway/platforms/api_server.py
      const apiServerModule = meta.astOutlines!.find((m) =>
        m.modulePath.includes("api_server.py")
      );
      expect(apiServerModule).toBeDefined();
      expect(apiServerModule!.classes.some((c) => c.name === "APIServerAdapter")).toBe(true);

      // 2. 模拟沙箱运行捕获 Hermes-Agent 真实的生产环境堆栈
      const sandbox = new MockSandboxRunner((options) => {
        expect(options.scriptContent).toContain("_find_all_skills");
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Traceback (most recent call last):
  File "/workspace/gateway/platforms/api_server.py", line 2774, in _handle_skills
    skills = _sort_skills(
        _find_all_skills(skip_disabled=False, include_editorial=True)
    )
TypeError: _find_all_skills() got an unexpected keyword argument 'include_editorial'`,
        };
      });

      // 3. 配置 LLM 推理生成器
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "TypeError",
          errorKeywords: ["unexpected keyword argument", "include_editorial"],
          reproScript: `import sys\nsys.path.insert(0, '/workspace')\nfrom tools.skills_tool import _find_all_skills\n_find_all_skills(skip_disabled=False, include_editorial=True)\n`,
          explanation: "调用 _find_all_skills 并传递被废弃的 include_editorial 关键词参数触发 TypeError",
        }),
      });

      // 4. 运行 ReproAgent 完整生命周期
      const agent = new ReproAgent({
        repoDir,
        issueTitle:
          "[Bug] GET /v1/skills crashes with TypeError: _find_all_skills() got an unexpected keyword argument 'include_editorial'",
        issueBody:
          "When sending GET /v1/skills, the gateway server returns 500. Log: TypeError: _find_all_skills() got an unexpected keyword argument 'include_editorial' at gateway/platforms/api_server.py:2774",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();

      // 5. 断言闭环结果
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("TypeError");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("RepoClaw 自动化 Bug 复现报告 (Verified)");
      expect(result.markdownReport).toContain("TypeError");
      expect(result.markdownReport).toContain("include_editorial");
    } finally {
      if (tempDirToClean) {
        await fs.rm(tempDirToClean, { recursive: true, force: true });
      }
    }
  });
});
