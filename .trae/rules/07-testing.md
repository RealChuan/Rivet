1. 测试覆盖
   - 新增 IPC handler 必须附带单元测试
   - 新增 Store 的复杂 selector 必须有测试

2. 测试工具
   - UI 组件测试使用 React Testing Library
   - E2E 测试使用 Playwright + Electron
   - 禁止测试实现细节（如 `wrapper.instance()`）

3. 维护
   - 修改被测试覆盖的代码后同步更新对应测试用例
   - 允许直接删除过时的测试，不保留兼容测试
