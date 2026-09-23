/**
 * Python AST 函数/方法参数
 */
export interface AstParameter {
  name: string;
  typeAnnotation?: string;
  defaultValue?: string;
}

/**
 * Python AST 函数/方法定义
 */
export interface AstFunction {
  name: string;
  parameters: AstParameter[];
  returnType?: string;
  docstring?: string;
  isAsync?: boolean;
  startLine?: number;
}

/**
 * Python AST 类定义
 */
export interface AstClass {
  name: string;
  bases?: string[];
  docstring?: string;
  methods: AstFunction[];
  startLine?: number;
}

/**
 * 单个 Python 模块文件的 AST 符号大纲
 */
export interface AstModuleOutline {
  modulePath: string;
  moduleName: string;
  classes: AstClass[];
  functions: AstFunction[];
  topLevelVariables?: string[];
}
