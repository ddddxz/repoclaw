import { describe, it, expect } from "vitest";
import { matchExecutionTraceback } from "../src/matcher.js";

describe("@repoclaw/core 堆栈特征匹配器测试", () => {
  it("当抛出预期异常且包含关键词时，判定为已确证 (Verified)", () => {
    const stderr = `
Traceback (most recent call last):
  File "/workspace/src/math.py", line 10, in div
    return a / b
ZeroDivisionError: division by zero
    `.trim();

    const result = matchExecutionTraceback(
      "ZeroDivisionError",
      ["division by zero"],
      stderr
    );

    expect(result.isVerified).toBe(true);
    expect(result.actualException).toBe("ZeroDivisionError");
    expect(result.hasKeywordMatch).toBe(true);
    expect(result.isRecoverableError).toBe(false);
  });

  it("当抛出 ModuleNotFoundError 时，判定为可自愈前置错误", () => {
    const stderr = `
Traceback (most recent call last):
  File "/scratch/repro.py", line 1, in <module>
    import missing_package
ModuleNotFoundError: No module named 'missing_package'
    `.trim();

    const result = matchExecutionTraceback("ZeroDivisionError", [], stderr);

    expect(result.isVerified).toBe(false);
    expect(result.actualException).toBe("ModuleNotFoundError");
    expect(result.isRecoverableError).toBe(true);
  });

  it("当实际抛出的异常类型与预期不一致时，判定为未确证", () => {
    const stderr = `
Traceback (most recent call last):
  File "/scratch/repro.py", line 4, in <module>
    raise ValueError("Invalid argument")
ValueError: Invalid argument
    `.trim();

    const result = matchExecutionTraceback("KeyError", [], stderr);

    expect(result.isVerified).toBe(false);
    expect(result.actualException).toBe("ValueError");
    expect(result.isRecoverableError).toBe(false);
  });

  it("当未捕获任何报错时，正确反馈未捕获异常", () => {
    const result = matchExecutionTraceback("ZeroDivisionError", [], "");

    expect(result.isVerified).toBe(false);
    expect(result.actualException).toBe("None");
  });
});
