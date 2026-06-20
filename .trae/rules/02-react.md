1. 组件基础
   - 所有组件显式定义 Props 接口，禁止隐式 `children`
   - 组件超过 500 行必须拆分；禁止深层嵌套目录（最多 3 层）

2. React 19+ API
   - `ref` 作为普通 prop，禁止 `forwardRef`
   - Context 直接作为 Provider：`<MyContext>` 替代 `<MyContext.Provider>`
   - 依赖 React Compiler 自动 memoization，禁止无意义的手动 `useMemo`/`useCallback`
   - `useEffect` 依赖数组引用的函数/对象必须有稳定引用（此场景下手动 `useCallback`/`useMemo` 必要）
   - 可用 `use()` 在 render 内读取 Promise/Context；可用 `useEffectEvent` 解耦 Effect 依赖

3. Hooks 规范
   - 禁止在条件/循环/嵌套函数中调用 Hooks
   - 列表渲染 `key` 必须是稳定唯一标识，禁止 `key={index}`

4. 错误边界
   - 应用必须有顶层 Error Boundary；捕获的异常通过日志模块上报
