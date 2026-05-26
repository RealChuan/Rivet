1. Store 定义
   - Store 命名：`use[Feature]Store.ts`
   - 必须导出 `use[Feature]Store` hook，禁止导出裸 store 实例

2. 订阅规范
   - 组件内订阅必须使用 selector：`useStore(state => state.xxx)`，禁止 `useStore().xxx`
   - 状态更新必须通过 `set()` / `get()`，禁止直接赋值 `store.state = xxx`

3. Persist
   - Zustand 5.x 已修复 persist 并发 rehydrate race condition，使用 persist 时无需额外加锁
   - 使用 `persist` 中间件时配合 `createJSONStorage` 确保类型安全
