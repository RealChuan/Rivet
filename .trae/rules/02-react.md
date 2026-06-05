1. 组件基础
   - 所有组件显式定义 Props 接口，禁止隐式 `children`
   - 组件超过 500 行必须拆分，子组件放在同级目录
   - 禁止深层嵌套目录（最多 3 层）

2. React 19 新特性
   - React 19+ 支持 `ref` 作为普通 prop，禁止再使用 `forwardRef`
   - React 19+ 支持 Context 直接作为 Provider（`<MyContext>` 替代 `<MyContext.Provider>`），优先使用简化语法
   - 必须依赖 React Compiler 实现自动 memoization，禁止无意义的手动 `useMemo`/`useCallback`
   - 被 `useEffect` 依赖数组引用的函数和对象必须有稳定引用（手动 `useCallback`/`useMemo` 在此场景下是必要的，不属于"无意义"）

3. Hooks 规范
   - Hooks 调用顺序固定，禁止在条件、循环、嵌套函数中调用 `useXxx`
   - 列表渲染 `key` 必须是稳定唯一标识，绝对禁止 `key={index}`

4. 错误边界
   - 应用必须有顶层 Error Boundary，防止组件异常导致白屏
   - 错误边界捕获的异常必须通过日志模块上报
