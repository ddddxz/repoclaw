import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractRepoAstOutlines,
  formatAstOutlineForPrompt,
  parsePythonAst,
} from "../src/ast.js";

describe("Python AST 语法树解析与符号提取", () => {
  it("应正确提取顶层函数、类型注解、默认值与首行 Docstring", () => {
    const pythonCode = `
def add(a: int, b: int = 10) -> int:
    """计算两个数字之和。

    详细说明：这是一个计算器辅助函数。
    """
    return a + b

def no_type_func(x, y=None):
    return x
`;

    const outline = parsePythonAst(pythonCode, "calc/math_ops.py");
    expect(outline.moduleName).toBe("calc.math_ops");
    expect(outline.modulePath).toBe("calc/math_ops.py");
    expect(outline.functions.length).toBe(2);

    const addFunc = outline.functions[0];
    expect(addFunc.name).toBe("add");
    expect(addFunc.returnType).toBe("int");
    expect(addFunc.docstring).toBe("计算两个数字之和。");
    expect(addFunc.parameters.length).toBe(2);
    expect(addFunc.parameters[0]).toEqual({
      name: "a",
      typeAnnotation: "int",
      defaultValue: undefined,
    });
    expect(addFunc.parameters[1]).toEqual({
      name: "b",
      typeAnnotation: "int",
      defaultValue: "10",
    });

    const secondFunc = outline.functions[1];
    expect(secondFunc.name).toBe("no_type_func");
    expect(secondFunc.parameters[1].defaultValue).toBe("None");
  });

  it("应支持多行参数签名、异步函数与 *args/**kwargs", () => {
    const pythonCode = `
async def fetch_user_data(
    user_id: str,
    timeout: float = 30.5,
    *args,
    **kwargs
) -> dict:
    """异步拉取指定用户的数据"""
    pass
`;

    const outline = parsePythonAst(pythonCode, "api/client.py");
    expect(outline.functions.length).toBe(1);
    const fn = outline.functions[0];
    expect(fn.name).toBe("fetch_user_data");
    expect(fn.isAsync).toBe(true);
    expect(fn.returnType).toBe("dict");
    expect(fn.docstring).toBe("异步拉取指定用户的数据");
    expect(fn.parameters.length).toBe(4);
    expect(fn.parameters[0].name).toBe("user_id");
    expect(fn.parameters[1].defaultValue).toBe("30.5");
    expect(fn.parameters[2].name).toBe("*args");
    expect(fn.parameters[3].name).toBe("**kwargs");
  });

  it("应正确解析类定义、基类继承、类内方法与顶层常量", () => {
    const pythonCode = `
MAX_RETRIES = 3

class BaseWorker:
    pass

class DataProcessor(BaseWorker, Serializable):
    """数据处理流水线引擎"""

    def __init__(self, buffer_size: int = 1024):
        self.buffer_size = buffer_size

    async def process(self, payload: bytes) -> bool:
        """执行异步消息消费与处理"""
        return True
`;

    const outline = parsePythonAst(pythonCode, "engine/processor.py");
    expect(outline.topLevelVariables).toContain("MAX_RETRIES");
    expect(outline.classes.length).toBe(2);

    const baseWorker = outline.classes[0];
    expect(baseWorker.name).toBe("BaseWorker");
    expect(baseWorker.methods.length).toBe(0);

    const processor = outline.classes[1];
    expect(processor.name).toBe("DataProcessor");
    expect(processor.bases).toEqual(["BaseWorker", "Serializable"]);
    expect(processor.docstring).toBe("数据处理流水线引擎");
    expect(processor.methods.length).toBe(2);

    const initMethod = processor.methods[0];
    expect(initMethod.name).toBe("__init__");
    expect(initMethod.parameters[0].name).toBe("self");
    expect(initMethod.parameters[1].defaultValue).toBe("1024");

    const processMethod = processor.methods[1];
    expect(processMethod.name).toBe("process");
    expect(processMethod.isAsync).toBe(true);
    expect(processMethod.returnType).toBe("bool");
    expect(processMethod.docstring).toBe("执行异步消息消费与处理");
  });

  it("应将 AST 符号正确格式化为 Python Stub 紧凑骨架", () => {
    const pythonCode = `
class Calculator:
    """经典计算器"""
    def calculate(self, a: int, b: int = 0) -> float:
        return a / b

def quick_add(x: int, y: int) -> int:
    return x + y
`;

    const outline = parsePythonAst(pythonCode, "my_package/calculator.py");
    const stub = formatAstOutlineForPrompt([outline]);

    expect(stub).toContain("# 模块: my_package.calculator (路径: my_package/calculator.py)");
    expect(stub).toContain("class Calculator:");
    expect(stub).toContain('"""经典计算器"""');
    expect(stub).toContain("def calculate(self, a: int, b: int = 0) -> float: ...");
    expect(stub).toContain("def quick_add(x: int, y: int) -> int: ...");
  });

  it("应支持从整个仓库目录中扫描并按关键词权重加权排序", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "repoclaw-ast-test-"));
    try {
      // 1. 创建符合忽略规则的目录结构 (tests 目录应被忽略)
      await fs.mkdir(path.join(tmpDir, "tests"), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, "tests", "test_calc.py"),
        "def test_add(): pass"
      );

      // 2. 创建真实模块目录
      await fs.mkdir(path.join(tmpDir, "calc"), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, "calc", "calculator.py"),
        `
class Calculator:
    def divide(self, a: float, b: float) -> float:
        return a / b
`
      );

      await fs.writeFile(
        path.join(tmpDir, "calc", "string_utils.py"),
        `
def format_title(title: str) -> str:
    return title.title()
`
      );

      // 3. 执行提取，查询关键词为 calculator
      const outlines = await extractRepoAstOutlines(tmpDir, {
        keywords: ["calculator", "divide"],
      });

      // 验证 tests 目录被排除
      expect(outlines.some((o) => o.modulePath.includes("tests"))).toBe(false);

      // 验证 calculator.py 权重最高，排在第一位
      expect(outlines.length).toBe(2);
      expect(outlines[0].modulePath).toBe("calc/calculator.py");
      expect(outlines[0].classes[0].name).toBe("Calculator");
      expect(outlines[0].classes[0].methods[0].name).toBe("divide");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
