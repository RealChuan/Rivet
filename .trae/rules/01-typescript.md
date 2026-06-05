1. 编译器配置
   - `strict: true`、`noImplicitAny: true`、`strictNullChecks: true` 不可关闭
   - TypeScript 6.x 是当前稳定主版本，TS 7.0（Project Corsa，Go 编译器）为 preview 状态，两者语言特性一致，仅为编译器实现变更
   - 大型项目开启 `incremental: true` 和 `composite: true`

2. 类型安全
   - 禁止隐式 `any`，禁止裸 `as` 类型断言（除非附注释说明原因）
   - 禁止非空断言 `!`（除非上一行有 `if (x === null) throw` 守卫）
   - 公共 API 的类型定义收敛到独立类型文件，禁止在业务文件里内联导出复杂接口

3. Node.js 原生类型剥离
   - 必须启用 `--erasableSyntaxOnly` 兼容 Node.js 原生类型剥离（TypeScript 6.0+ 支持，Node.js 23.6+ 原生执行 TS）
   - 必须启用 `verbatimModuleSyntax`，确保 import/export 在输出 JS 中精确保留，替代已废弃的 `importsNotUsedAsValues` 和 `preserveValueImports`
   - 禁止 enum（使用 `as const` 对象 + 派生类型替代）和参数属性（为 Node.js 原生类型剥离和 TS 7.0 迁移做准备）
