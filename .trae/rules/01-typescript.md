1. 编译器配置
   - `strict: true`、`noImplicitAny: true`、`strictNullChecks: true` 不可关闭
   - TypeScript 6.x 是最后一个 JS 版本，TS 7.0（Go 编译器，Project Corsa）为 preview 状态
   - 大型项目开启 `incremental: true` 和 `composite: true`

2. 类型安全
   - 禁止隐式 `any`，禁止裸 `as` 类型断言（除非附注释说明原因）
   - 禁止非空断言 `!`（除非上一行有 `if (x === null) throw` 守卫）
   - 公共 API 的类型定义收敛到独立类型文件，禁止在业务文件里内联导出复杂接口

3. Node.js 原生类型剥离
   - 优先使用 `--erasableSyntaxOnly` 兼容 Node.js 原生类型剥离（TypeScript 6.0+ 支持）
   - 使用 `verbatimModuleSyntax` 替代 `importsNotUsedAsValues` 和 `preserveValueImports`
   - 避免 enum 和参数属性（为 TS 7.0 迁移做准备）
