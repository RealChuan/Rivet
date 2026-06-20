1. Store 定义
   - 文件命名 `kebab-case.ts`，导出 `use[Feature]Store` hook，禁止导出裸 store 实例
   - 类型定义与实现放同一文件或同级 `types.ts`

2. 订阅规范
   - 组件内必须用 selector：`useStore(state => state.xxx)`，禁止 `useStore().xxx`
   - 多值 selector 用 `useShallow`（`zustand/react/shallow`）：`useStore(useShallow(s => ({ a: s.a, b: s.b })))`
   - 状态更新通过 `set()`/`get()`，禁止直接赋值 `store.state = xxx`

3. 中间件
   - `persist` 配合 `createJSONStorage`；`immer` 组合顺序 `immer → persist → devtools`
   - `immer` 非强制，`set()` 展开运算符同样可实现不可变更新
