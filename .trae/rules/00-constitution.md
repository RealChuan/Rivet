1. 核心原则
   - 允许破坏性变更，无需向后兼容
   - 修改公共 API 后同步修改所有调用方
   - 优先使用现有技术栈解决问题；允许引入新库；新库与已安装库功能相似时需评估择优（紧跟主流标准，保留更优者并迁移调用方），禁止同时保留多个功能相似的库
   - 一个逻辑单元的所有文件修改完成后，统一运行 `pnpm run ci`，未通过则继续修复

2. 技术栈基线
   - Electron ^42 | React ^19 | TypeScript ^6 | Zustand ^5 | Tailwind CSS ^4 | i18next ^26 | Vite ^8 | Vitest ^4
   - TS 7 (tsgo) 为 Go 编译器，暂不可通过 npm 安装，当前基线为 TS 6.x

3. 命名规范
   - 文件夹/工具函数/服务/Store：kebab-case | React 组件：PascalCase.tsx
   - 新增模块遵循现有目录结构，禁止新建平行目录
   - 重命名文件后同步修改所有 import 路径

4. 质量底线
   - 主进程错误用日志模块(`electron-log`)写入文件，禁止 `console.error`；渲染进程错误上报主进程
   - 用户可见错误必须经 i18n 翻译
   - 大型列表(>50 项)必须用虚拟滚动；禁止在主进程做阻塞操作
   - 窗口关闭/组件卸载时必须清理 IPC 监听器、定时器、Store 非 hook 订阅

5. CI 门禁
   - `pnpm run ci` 通过标准：lint 零错误、test 零失败、build 零报错、typecheck 零类型错误
   - CI 未通过禁止标记任务完成；禁止注释测试/跳过 lint/改 CI 配置来让 CI 通过

6. 测试
   - 新增 IPC handler 必须附带单元测试；新增 Store 复杂 selector 必须有测试
   - UI 组件测试用 React Testing Library，E2E 用 Playwright + Electron
   - 修改被测试覆盖的代码后同步更新测试用例

7. 规则进化
   - 规则与 npm 包实际用法冲突时以 npm 包为准；与最新主流标准冲突时以最新标准为准
   - 修改规则后运行 `pnpm run ci` 验证，未通过则回滚
