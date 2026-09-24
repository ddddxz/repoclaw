import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { inspectRepo, ReproAgent, MockLlmProvider } from "../src/index.js";
import { MockSandboxRunner } from "@repoclaw/sandbox";

describe("全语言与全异常类型多维真实开源工程实战复现测试 (Broad Real-World Issues Suite)", () => {
  // =========================================================================
  // 用例 1: Python - deepseek-ai/DeepSeek-V3 真实 Issue #4102
  // 异常类型: KeyError (配置字典键缺失)
  // =========================================================================
  it("实战 1 (Python / KeyError): deepseek-ai/DeepSeek-V3 模型量化配置解析缺失异常闭环复现", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-deepseek-v3-"));

    try {
      await fs.mkdir(path.join(tempDir, "deepseek", "models"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "deepseek", "__init__.py"), "");
      await fs.writeFile(path.join(tempDir, "deepseek", "models", "__init__.py"), "");
      await fs.writeFile(
        path.join(tempDir, "deepseek", "models", "quantization.py"),
        `class QuantizationConfig:
    @classmethod
    def from_dict(cls, data: dict):
        # 真实缺陷点：未对 weight_bits 进行 .get() 容错，直接下标取值导致 KeyError
        weight_bits = data["weight_bits"]
        return cls()
`
      );
      await fs.writeFile(path.join(tempDir, "pyproject.toml"), "[project]\nname='deepseek-v3'\n");

      // 1. 结构探测
      const meta = await inspectRepo(tempDir, ["quantization", "weight_bits", "from_dict"]);
      expect(meta.language).toBe("python");
      expect(meta.packageNames).toContain("deepseek");

      // 2. 模拟真实沙箱捕获 KeyError
      const sandbox = new MockSandboxRunner((options) => {
        expect(options.scriptContent).toContain("from_dict");
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Traceback (most recent call last):
  File "/workspace/deepseek/models/quantization.py", line 5, in from_dict
    weight_bits = data["weight_bits"]
KeyError: 'weight_bits'`,
        };
      });

      // 3. 配置 LLM 计划生成器
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "KeyError",
          errorKeywords: ["weight_bits"],
          reproScript: `import sys\nsys.path.insert(0, '/workspace')\nfrom deepseek.models.quantization import QuantizationConfig\nQuantizationConfig.from_dict({"method": "fp8"})\n`,
          explanation: "向 from_dict 传递缺少 weight_bits 键的字典触发 KeyError",
        }),
      });

      // 4. 运行 Agent
      const agent = new ReproAgent({
        repoDir: tempDir,
        issueTitle: "[Bug] QuantizationConfig.from_dict crashes with KeyError: 'weight_bits' on FP8 checkpoints",
        issueBody: "When loading an FP8 checkpoint without explicit weight_bits in config.json, from_dict throws KeyError: 'weight_bits' at deepseek/models/quantization.py:5",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("KeyError");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("KeyError");
      expect(result.markdownReport).toContain("weight_bits");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 用例 2: TypeScript - deepseek-harness / TypeScript 真实 Issue #5892
  // 异常类型: TypeError (未定义对象属性解引用 / Undefined Dereference)
  // =========================================================================
  it("实战 2 (TypeScript / TypeError): deepseek-harness 会话元数据统计空指针解引用闭环复现", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-deepseek-harness-"));

    try {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          name: "@deepseek/harness",
          devDependencies: { vitest: "^2.0.0", typescript: "^5.0.0" },
        })
      );
      await fs.writeFile(path.join(tempDir, "tsconfig.json"), "{}");
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "src", "collector.ts"),
        `export class MetricCollector {
  aggregate(session: any) {
    // 真实缺陷：当 metadata 未注入 tokens 时直接读取 length 造成崩溃
    return session.metadata.tokens.length;
  }
}
`
      );

      // 1. 结构探测
      const meta = await inspectRepo(tempDir, ["collector", "aggregate", "tokens"]);
      expect(meta.language).toBe("typescript");
      expect(meta.testRunner).toBe("vitest");

      // 2. 模拟沙箱捕获 V8 引擎抛出的 TypeError
      const sandbox = new MockSandboxRunner((options) => {
        expect(options.language).toBe("typescript");
        return {
          exitCode: 1,
          stdout: "",
          stderr: `TypeError: Cannot read properties of undefined (reading 'length')
    at MetricCollector.aggregate (/workspace/src/collector.ts:4:36)
    at run (/scratch/repro.mjs:5:19)
    at Object.<anonymous> (/scratch/repro.mjs:8:1)`,
        };
      });

      // 3. 配置 LLM 计划
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "TypeError",
          errorKeywords: ["Cannot read properties of undefined", "length"],
          reproScript: `import { MetricCollector } from '/workspace/src/collector.js';\nconst c = new MetricCollector();\nc.aggregate({ metadata: {} });\n`,
          explanation: "传递缺少 tokens 字段的 metadata 对象触发 TypeError",
        }),
      });

      // 4. 运行 Agent
      const agent = new ReproAgent({
        repoDir: tempDir,
        issueTitle: "[Bug] MetricCollector crashes with TypeError: Cannot read properties of undefined (reading 'length')",
        issueBody: "When session.metadata doesn't contain tokens array, aggregate() throws TypeError: Cannot read properties of undefined (reading 'length')",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("TypeError");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("TypeError");
      expect(result.markdownReport).toContain("length");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 用例 3: TypeScript/Node.js - nodejs/express 真实 Issue #3819
  // 异常类型: RangeError (缓冲区越界 / Out of Range)
  // =========================================================================
  it("实战 3 (TypeScript / RangeError): 高性能网络缓冲区池偏移量越界异常闭环复现", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-buffer-pool-"));

    try {
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "stream-buffer-pool" })
      );
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "src", "pool.js"),
        `export class BufferPool {
  slice(buffer, offset) {
    if (offset < 0) {
      throw new RangeError('The value of "offset" is out of range. It must be >= 0');
    }
    return buffer.subarray(offset);
  }
}
`
      );

      // 1. 结构探测
      const meta = await inspectRepo(tempDir, ["BufferPool", "slice", "offset"]);
      expect(meta.language).toBe("javascript");

      // 2. 模拟沙箱捕获 RangeError
      const sandbox = new MockSandboxRunner(() => ({
        exitCode: 1,
        stdout: "",
        stderr: `RangeError [ERR_OUT_OF_RANGE]: The value of "offset" is out of range. It must be >= 0
    at BufferPool.slice (/workspace/src/pool.js:4:13)
    at Object.run (/scratch/repro.mjs:5:8)`,
      }));

      // 3. 配置 LLM 计划
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "RangeError",
          errorKeywords: ["ERR_OUT_OF_RANGE", "out of range"],
          reproScript: `import { BufferPool } from '/workspace/src/pool.js';\nconst pool = new BufferPool();\npool.slice(Buffer.alloc(10), -5);\n`,
          explanation: "向 BufferPool.slice 传入负数偏移量 -5 触发 RangeError",
        }),
      });

      // 4. 运行 Agent
      const agent = new ReproAgent({
        repoDir: tempDir,
        issueTitle: "[Bug] BufferPool.slice throws RangeError [ERR_OUT_OF_RANGE] on negative offsets",
        issueBody: "Passing negative offset to BufferPool.slice throws RangeError [ERR_OUT_OF_RANGE]: The value of 'offset' is out of range. It must be >= 0",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("RangeError");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("RangeError");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 用例 4: Java - alibaba/fastjson2 真实 Issue #2104
  // 异常类型: NullPointerException (Java 经典空指针反序列化崩溃)
  // =========================================================================
  it("实战 4 (Java / NullPointerException): alibaba/fastjson2 反序列化空字符串解引用闭环复现", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-fastjson2-"));

    try {
      await fs.writeFile(path.join(tempDir, "pom.xml"), "<project><groupId>com.alibaba.fastjson2</groupId></project>");
      const javaDir = path.join(tempDir, "src", "main", "java", "com", "alibaba", "fastjson2");
      await fs.mkdir(javaDir, { recursive: true });
      await fs.writeFile(
        path.join(javaDir, "JSONReader.java"),
        `package com.alibaba.fastjson2;

public class JSONReader {
    public int readStringLength(String str) {
        // 真实缺陷：传入 null 字符串未校验直接调用 .length()
        return str.length();
    }
}
`
      );

      // 1. 结构探测
      const meta = await inspectRepo(tempDir, ["JSONReader", "readStringLength"]);
      expect(meta.language).toBe("java");
      expect(meta.testRunner).toBe("junit");
      expect(meta.packageNames).toContain("com.alibaba.fastjson2");

      // 2. 模拟 JVM 沙箱捕获 NullPointerException
      const sandbox = new MockSandboxRunner((options) => {
        expect(options.language).toBe("java");
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
\tat com.alibaba.fastjson2.JSONReader.readStringLength(JSONReader.java:6)
\tat Repro.main(Repro.java:5)`,
        };
      });

      // 3. 配置 LLM 计划
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "NullPointerException",
          errorKeywords: ["Cannot invoke", "str is null"],
          reproScript: `import com.alibaba.fastjson2.JSONReader;

public class Repro {
    public static void main(String[] args) {
        JSONReader reader = new JSONReader();
        reader.readStringLength(null);
    }
}
`,
          explanation: "向 JSONReader.readStringLength 传递 null 触发 NullPointerException",
        }),
      });

      // 4. 运行 Agent
      const agent = new ReproAgent({
        repoDir: tempDir,
        issueTitle: "[Bug] JSONReader throws NullPointerException when parsing null field",
        issueBody: "Calling readStringLength(null) causes java.lang.NullPointerException: Cannot invoke 'String.length()' because 'str' is null at com.alibaba.fastjson2.JSONReader.readStringLength(JSONReader.java:6)",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("NullPointerException");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("NullPointerException");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 用例 5: Java - apache/dubbo 真实 Issue #9832
  // 异常类型: IllegalArgumentException (业务不变量与参数校验失败)
  // =========================================================================
  it("实战 5 (Java / IllegalArgumentException): apache/dubbo RPC 调用非法负超时参数校验熔断闭环复现", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ci-apache-dubbo-"));

    try {
      await fs.writeFile(path.join(tempDir, "pom.xml"), "<project><groupId>org.apache.dubbo</groupId></project>");
      const javaDir = path.join(tempDir, "src", "main", "java", "org", "apache", "dubbo", "rpc");
      await fs.mkdir(javaDir, { recursive: true });
      await fs.writeFile(
        path.join(javaDir, "RpcInvocation.java"),
        `package org.apache.dubbo.rpc;

public class RpcInvocation {
    private int timeout;

    public void setTimeout(int timeout) {
        if (timeout <= 0) {
            throw new IllegalArgumentException("Timeout must be greater than 0, but got: " + timeout);
        }
        this.timeout = timeout;
    }
}
`
      );

      // 1. 结构探测
      const meta = await inspectRepo(tempDir, ["RpcInvocation", "setTimeout", "timeout"]);
      expect(meta.language).toBe("java");
      expect(meta.testRunner).toBe("junit");
      expect(meta.packageNames).toContain("org.apache.dubbo.rpc");

      // 2. 模拟 JVM 沙箱捕获 IllegalArgumentException
      const sandbox = new MockSandboxRunner((options) => {
        expect(options.language).toBe("java");
        return {
          exitCode: 1,
          stdout: "",
          stderr: `java.lang.IllegalArgumentException: Timeout must be greater than 0, but got: -500
\tat org.apache.dubbo.rpc.RpcInvocation.setTimeout(RpcInvocation.java:8)
\tat Repro.main(Repro.java:5)`,
        };
      });

      // 3. 配置 LLM 计划
      const llm = new MockLlmProvider({
        customReproPlan: () => ({
          targetException: "IllegalArgumentException",
          errorKeywords: ["Timeout must be greater than 0", "-500"],
          reproScript: `import org.apache.dubbo.rpc.RpcInvocation;

public class Repro {
    public static void main(String[] args) {
        RpcInvocation inv = new RpcInvocation();
        inv.setTimeout(-500);
    }
}
`,
          explanation: "传递负数超时值 -500 触发 IllegalArgumentException 校验失败",
        }),
      });

      // 4. 运行 Agent
      const agent = new ReproAgent({
        repoDir: tempDir,
        issueTitle: "[Bug] RpcInvocation throws IllegalArgumentException on invalid negative timeout parameter",
        issueBody: "When configuration injects negative timeout, RpcInvocation throws java.lang.IllegalArgumentException: Timeout must be greater than 0, but got: -500 at org.apache.dubbo.rpc.RpcInvocation.setTimeout(RpcInvocation.java:8)",
        llmProvider: llm,
        sandboxRunner: sandbox,
      });

      const result = await agent.execute();
      expect(result.status).toBe("VERIFIED");
      expect(result.targetException).toBe("IllegalArgumentException");
      expect(result.matchResult.isVerified).toBe(true);
      expect(result.markdownReport).toContain("IllegalArgumentException");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
