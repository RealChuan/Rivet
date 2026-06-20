1. 编译器配置
   - `strict: true`、`noImplicitAny: true`、`strictNullChecks: true` 不可关闭
   - 当前基线 TypeScript 6.x；TS 7 (tsgo) 是 Go 编译器，暂不可通过 npm 安装，待可用后迁移
   - `noEmit` 工程可开启 `incremental: true` 加速重复检查；`composite` 与 `noEmit` 互斥
   - 生成 `.d.ts` 的工程必须开启 `isolatedDeclarations: true`（与 `noEmit` 互斥）

2. 类型安全
   - 禁止隐式 `any`、裸 `as` 断言、非空断言 `!`（除非上一行有 null 守卫）
   - 公共 API 类型收敛到独立类型文件

3. 语法限制
   - 必须启用 `verbatimModuleSyntax`、`erasableSyntaxOnly`
   - 禁止 enum（用 `as const` 对象替代）、禁止参数属性
   - 必须启用 `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`

4. 模块路径
   - 优先使用 Node.js subpath imports（`package.json` `imports` 字段），`paths` 别名仅用于 Vite
