import { describe, it, expect } from "vitest";
import {
  ReproPlanSchema,
  ReflectionSchema,
  TaskStatusEnum,
  IssuePayloadSchema,
} from "../src/index.js";

describe("@repoclaw/shared 数据契约与 Schema 校验测试", () => {
  it("应成功解析合规的 ReproPlan 模型", () => {
    const validPlan = {
      targetException: "ZeroDivisionError",
      errorKeywords: ["division by zero", "calc.py"],
      reproScript: "from calc import divide\ndivide(1, 0)",
      explanation: "调用 divide 传入除数 0 以触发 ZeroDivisionError 异常",
    };

    const parsed = ReproPlanSchema.safeParse(validPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.targetException).toBe("ZeroDivisionError");
      expect(parsed.data.errorKeywords).toContain("division by zero");
    }
  });

  it("当 ReproPlan 缺少必填字段时应拦截并报错", () => {
    const invalidPlan = {
      targetException: "",
      reproScript: "",
    };

    const parsed = ReproPlanSchema.safeParse(invalidPlan);
    expect(parsed.success).toBe(false);
  });

  it("应正确验证 Reflection 修复操作类型", () => {
    const validReflection = {
      analysis: "缺少目标模块路径，需要在 sys.path 中加入 /workspace",
      actionType: "PATCH_IMPORTS",
      patchedScript: "import sys\nsys.path.insert(0, '/workspace')\nimport mypkg",
    };

    const parsed = ReflectionSchema.safeParse(validReflection);
    expect(parsed.success).toBe(true);
  });

  it("应正确校验 ChatOps IssuePayload 载荷结构", () => {
    const validPayload = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      repoFullName: "facebook/react",
      repoCloneUrl: "https://github.com/facebook/react.git",
      issueNumber: 1024,
      issueTitle: "Crash when rendering nested fragment with empty keys",
      issueBody: "When running the following code, it throws TypeError: Cannot read property...",
      commentId: 54321,
      triggerUser: "octocat",
      authorAssociation: "COLLABORATOR",
    };

    const parsed = IssuePayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("应包含所有合规的 TaskStatusEnum 枚举值", () => {
    const statuses = TaskStatusEnum.options;
    expect(statuses).toEqual([
      "PENDING",
      "RUNNING",
      "VERIFIED",
      "UNVERIFIED",
      "FAILED",
    ]);
  });
});
