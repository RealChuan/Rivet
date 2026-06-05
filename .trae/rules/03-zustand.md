1. Store 定义
   - Store 文件命名遵循 `kebab-case.ts`（如 `ui.ts`、`session.ts`），必须导出 `use[Feature]Store` hook，禁止导出裸 store 实例
   - Store 类型定义与实现放在同一文件，或收敛到同级 `types.ts`

2. 订阅规范
   - 组件内订阅必须使用 selector：`useStore(state => state.xxx)`，禁止 `useStore().xxx`
   - 多值 selector 必须使用 `shallow` 比较：`useStore(s => ({ a: s.a, b: s.b }), shallow)`
   - 状态更新必须通过 `set()` / `get()`，禁止直接赋值 `store.state = xxx`

3. 中间件
   - 使用 `persist` 中间件时配合 `createJSONStorage` 确保类型安全
   - 中间件组合顺序：`immer → persist → devtools`（官方推荐）
