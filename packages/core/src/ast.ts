import fs from "node:fs/promises";
import path from "node:path";
import type {
  AstClass,
  AstFunction,
  AstModuleOutline,
  AstParameter,
} from "@repoclaw/shared";

export interface AstExtractOptions {
  maxFiles?: number;
  keywords?: string[];
  moduleNamePrefix?: string;
}

/**
 * 安全分割参数字符串（考虑嵌套括号与引号）
 */
function splitParameters(rawParams: string): string[] {
  const params: string[] = [];
  let current = "";
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escape = false;

  for (let i = 0; i < rawParams.length; i++) {
    const char = rawParams[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escape = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "(" || char === "[" || char === "{") {
        parenDepth++;
      } else if (char === ")" || char === "]" || char === "}") {
        parenDepth--;
      } else if (char === "," && parenDepth === 0) {
        if (current.trim().length > 0) {
          params.push(current.trim());
        }
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim().length > 0) {
    params.push(current.trim());
  }

  return params;
}

/**
 * 解析单个参数定义 (如 `a: int = 10` 或 `*args` 或 `b=None`)
 */
function parseSingleParameter(raw: string): AstParameter {
  let nameAndType = raw;
  let defaultValue: string | undefined;

  // 寻找不在括号内的等号
  let eqIndex = -1;
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
    else if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (c === "(" || c === "[" || c === "{") parenDepth++;
      else if (c === ")" || c === "]" || c === "}") parenDepth--;
      else if (c === "=" && parenDepth === 0) {
        eqIndex = i;
        break;
      }
    }
  }

  if (eqIndex !== -1) {
    nameAndType = raw.slice(0, eqIndex).trim();
    defaultValue = raw.slice(eqIndex + 1).trim();
  }

  let name = nameAndType;
  let typeAnnotation: string | undefined;

  // 寻找冒号
  let colonIndex = -1;
  parenDepth = 0;
  inSingleQuote = false;
  inDoubleQuote = false;

  for (let i = 0; i < nameAndType.length; i++) {
    const c = nameAndType[i];
    if (c === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
    else if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (c === "(" || c === "[" || c === "{") parenDepth++;
      else if (c === ")" || c === "]" || c === "}") parenDepth--;
      else if (c === ":" && parenDepth === 0) {
        colonIndex = i;
        break;
      }
    }
  }

  if (colonIndex !== -1) {
    name = nameAndType.slice(0, colonIndex).trim();
    typeAnnotation = nameAndType.slice(colonIndex + 1).trim();
  }

  return {
    name,
    typeAnnotation,
    defaultValue,
  };
}

/**
 * 计算行首缩进空格数 (tab 按 4 个空格计)
 */
function getIndentLevel(line: string): number {
  let indent = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ") indent += 1;
    else if (line[i] === "\t") indent += 4;
    else break;
  }
  return indent;
}

/**
 * 提取紧随其后的首行 Docstring
 */
function extractDocstring(lines: string[], startIndex: number): string | undefined {
  let idx = startIndex;
  while (idx < lines.length) {
    const raw = lines[idx];
    if (raw === undefined) {
      idx++;
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      idx++;
      continue;
    }

    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      const quote = trimmed.slice(0, 3);
      const rest = trimmed.slice(3).trim();
      if (rest.endsWith(quote) && rest.length >= 3) {
        return rest.slice(0, -3).trim() || undefined;
      }
      return rest || undefined;
    }
    break;
  }
  return undefined;
}

/**
 * 纯 TypeScript 实现的 Python AST 符号大纲提取器
 */
export function parsePythonAst(content: string, relativePath: string): AstModuleOutline {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const moduleName = normalizedPath
    .replace(/^src\//, "")
    .replace(/\.py$/, "")
    .replace(/\//g, ".");

  const lines = content.split(/\r?\n/);
  const classes: AstClass[] = [];
  const functions: AstFunction[] = [];
  const topLevelVariables: string[] = [];

  let currentClass: AstClass | null = null;
  let currentClassIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) {
      continue;
    }
    const indent = getIndentLevel(rawLine);
    const trimmed = rawLine.trim();

    // 跳过空行和纯注释
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    // 检查是否退出了当前类作用域
    if (currentClass !== null && indent <= currentClassIndent) {
      classes.push(currentClass);
      currentClass = null;
      currentClassIndent = -1;
    }

    // 1. 匹配类定义: class ClassName[(Bases)]:
    const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\((.*?)\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      if (!className) continue;

      if (currentClass !== null) {
        classes.push(currentClass);
      }

      const basesRaw = classMatch[2];
      const bases = basesRaw
        ? basesRaw
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)
        : undefined;

      const docstring = extractDocstring(lines, i + 1);

      currentClass = {
        name: className,
        bases,
        docstring,
        methods: [],
        startLine: i + 1,
      };
      currentClassIndent = indent;
      continue;
    }

    // 2. 匹配函数或方法定义: [async] def func_name(...) -> ReturnType:
    if (/^(?:async\s+)?def\s+/.test(trimmed)) {
      const isAsync = trimmed.startsWith("async ");
      const defLineStart = isAsync ? trimmed.slice(6) : trimmed;

      // 处理多行签名合并
      let fullDef = defLineStart;
      let nextLineIdx = i + 1;
      let parenCount = 0;

      for (let cIdx = 0; cIdx < fullDef.length; cIdx++) {
        const char = fullDef[cIdx];
        if (char === "(") parenCount++;
        else if (char === ")") parenCount--;
      }

      while (parenCount > 0 && nextLineIdx < lines.length) {
        const nextRaw = lines[nextLineIdx];
        if (nextRaw === undefined) break;
        const nextTrimmed = nextRaw.trim();
        fullDef += " " + nextTrimmed;
        for (let cIdx = 0; cIdx < nextTrimmed.length; cIdx++) {
          const char = nextTrimmed[cIdx];
          if (char === "(") parenCount++;
          else if (char === ")") parenCount--;
        }
        nextLineIdx++;
      }

      // 提取函数名、参数部分与返回值类型
      const funcRegex = /^def\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^:]+))?\s*:/;
      const funcMatch = fullDef.match(funcRegex);

      if (funcMatch) {
        const funcName = funcMatch[1];
        if (!funcName) continue;

        const rawParams = funcMatch[2] ?? "";
        const returnType = funcMatch[3]?.trim();

        const paramStrings = splitParameters(rawParams);
        const parameters = paramStrings.map(parseSingleParameter);
        const docstring = extractDocstring(lines, nextLineIdx);

        const astFunc: AstFunction = {
          name: funcName,
          parameters,
          returnType,
          docstring,
          isAsync,
          startLine: i + 1,
        };

        if (currentClass !== null && indent > currentClassIndent) {
          currentClass.methods.push(astFunc);
        } else if (indent === 0) {
          functions.push(astFunc);
        }

        i = nextLineIdx - 1;
        continue;
      }
    }

    // 3. 收集顶层关键赋值变量 (全大写常量或 __all__)
    if (indent === 0) {
      const constMatch = trimmed.match(/^([A-Z0-9_]+)\s*=/);
      if (constMatch) {
        const varName = constMatch[1];
        if (varName) {
          topLevelVariables.push(varName);
        }
      }
    }
  }

  if (currentClass !== null) {
    classes.push(currentClass);
  }

  return {
    modulePath: normalizedPath,
    moduleName,
    classes,
    functions,
    topLevelVariables: topLevelVariables.length > 0 ? topLevelVariables : undefined,
  };
}

/**
 * 将 AST 符号轮廓转换为面向大模型的紧凑 Python Stub 存根格式 (类似 .pyi 规范)
 */
export function formatAstOutlineForPrompt(outlines: AstModuleOutline[]): string {
  if (outlines.length === 0) {
    return "";
  }

  const sections: string[] = [];

  for (const outline of outlines) {
    if (outline.classes.length === 0 && outline.functions.length === 0) {
      continue;
    }

    const modLines: string[] = [];
    modLines.push(`# 模块: ${outline.moduleName} (路径: ${outline.modulePath})`);

    // 格式化类定义
    for (const cls of outline.classes) {
      const basesStr = cls.bases && cls.bases.length > 0 ? `(${cls.bases.join(", ")})` : "";
      modLines.push(`class ${cls.name}${basesStr}:`);
      if (cls.docstring) {
        modLines.push(`    """${cls.docstring}"""`);
      }

      if (cls.methods.length === 0) {
        modLines.push(`    ...`);
      } else {
        for (const method of cls.methods) {
          const asyncPrefix = method.isAsync ? "async " : "";
          const paramsStr = method.parameters
            .map((p) => {
              let res = p.name;
              if (p.typeAnnotation) res += `: ${p.typeAnnotation}`;
              if (p.defaultValue) res += ` = ${p.defaultValue}`;
              return res;
            })
            .join(", ");
          const retStr = method.returnType ? ` -> ${method.returnType}` : "";
          modLines.push(`    ${asyncPrefix}def ${method.name}(${paramsStr})${retStr}: ...`);
        }
      }
      modLines.push("");
    }

    // 格式化顶层函数
    for (const func of outline.functions) {
      const asyncPrefix = func.isAsync ? "async " : "";
      const paramsStr = func.parameters
        .map((p) => {
          let res = p.name;
          if (p.typeAnnotation) res += `: ${p.typeAnnotation}`;
          if (p.defaultValue) res += ` = ${p.defaultValue}`;
          return res;
        })
        .join(", ");
      const retStr = func.returnType ? ` -> ${func.returnType}` : "";
      if (func.docstring) {
        modLines.push(`"""${func.docstring}"""`);
      }
      modLines.push(`${asyncPrefix}def ${func.name}(${paramsStr})${retStr}: ...`);
    }

    sections.push(modLines.join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * 批量扫描目标仓库并按与 Issue 关键词的相关度提取关键模块的 AST 符号
 */
export async function extractRepoAstOutlines(
  repoDir: string,
  options?: AstExtractOptions
): Promise<AstModuleOutline[]> {
  const maxFiles = options?.maxFiles ?? 8;
  const rawKeywords = options?.keywords ?? [];
  const keywords = rawKeywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 1);

  // 1. 递归收集所有非忽略目录的 Python 文件
  const pyFiles: string[] = [];
  const ignoredDirs = new Set([
    ".git",
    "tests",
    "test",
    "testing",
    "venv",
    ".venv",
    "env",
    ".env",
    "build",
    "dist",
    "__pycache__",
    "node_modules",
    ".tox",
    ".pytest_cache",
    "site-packages",
    "docs",
    "examples",
  ]);

  async function walk(currentDir: string, relDir: string) {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relDir, entry.name).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          await walk(fullPath, relPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".py")) {
        // 排除 setup.py / conftest.py
        if (entry.name !== "setup.py" && entry.name !== "conftest.py") {
          pyFiles.push(relPath);
        }
      }
    }
  }

  await walk(repoDir, "");

  if (pyFiles.length === 0) {
    return [];
  }

  // 2. 根据关键词与结构重要性评分排序
  const scoredFiles: { relPath: string; score: number }[] = [];

  for (const relPath of pyFiles) {
    let score = 0;
    const lowerPath = relPath.toLowerCase();

    // 核心/常见入口加权
    if (lowerPath.endsWith("__init__.py")) score += 2;
    if (lowerPath.includes("core") || lowerPath.includes("main") || lowerPath.includes("api")) {
      score += 3;
    }

    // 关键词匹配加权
    for (const kw of keywords) {
      if (lowerPath.includes(kw)) {
        score += 15; // 路径或文件名直接命中关键词，极高权重
      }
    }

    // 若有关键词，尝试轻量读取前 50 行源码文本检索
    if (keywords.length > 0 && score < 15) {
      try {
        const fullPath = path.join(repoDir, relPath);
        const snippet = await fs.readFile(fullPath, { encoding: "utf8" });
        const lowerSnippet = snippet.slice(0, 4000).toLowerCase();
        for (const kw of keywords) {
          if (lowerSnippet.includes(kw)) {
            score += 5;
          }
        }
      } catch {
        // 忽略读取异常
      }
    }

    scoredFiles.push({ relPath, score });
  }

  // 按得分从高到低排序，截取 top N 文件
  scoredFiles.sort((a, b) => b.score - a.score);
  const selectedFiles = scoredFiles.slice(0, maxFiles).map((item) => item.relPath);

  // 3. 并行解析 AST
  const outlines: AstModuleOutline[] = [];
  for (const relPath of selectedFiles) {
    try {
      const fullPath = path.join(repoDir, relPath);
      const content = await fs.readFile(fullPath, "utf8");
      const outline = parsePythonAst(content, relPath);
      // 仅保留存在函数或类的模块
      if (outline.classes.length > 0 || outline.functions.length > 0) {
        outlines.push(outline);
      }
    } catch {
      // 容错跳过
    }
  }

  return outlines;
}
