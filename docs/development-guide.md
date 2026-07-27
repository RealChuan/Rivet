# 开发指南

本文档面向新加入项目的成员与编码 Agent，帮助快速熟悉 Rivet 代码库并开始贡献。Rivet 是一个基于 Electron + React + TypeScript 的 SFTP/WebDAV 文件浏览器。

## 环境搭建

### 前置要求

| 工具    | 版本       | 来源                                             |
| ------- | ---------- | ------------------------------------------------ |
| Node.js | `>=24.0.0` | [package.json](../package.json) `engines.node`   |
| pnpm    | `11.17.0`  | [package.json](../package.json) `packageManager` |

项目运行时与开发依赖（Electron / React / TypeScript / Zustand 等）的版本统一维护在 [架构文档技术栈表](./architecture.md#技术栈)，依赖升级时只需更新一处。

### 安装依赖

在项目根目录执行 `pnpm install`。[package.json](../package.json) 中未配置 `postinstall` 脚本，依赖安装完成后即可进入开发。原生模块（如 `ssh2-sftp-client`）的 Electron 重编译由 `electron-forge` 在启动/打包时自动处理。

### 启动开发

执行 `pnpm run dev`。该脚本定义为 `cross-env NODE_OPTIONS=--enable-source-maps electron-forge start`，由 [electron-forge](https://www.electronforge.io/) 编排：

1. 通过 [vite.renderer.config.ts](../vite.renderer.config.ts) 启动渲染进程 Vite Dev Server，提供 HMR。
2. 通过 [vite.main.config.ts](../vite.main.config.ts) 与 [vite.preload.config.ts](../vite.preload.config.ts) 构建主进程与 preload 脚本（输出到 `.vite/build/`），并开启 source map 以便调试。
3. 拉起 Electron 主窗口加载渲染进程入口。`NODE_OPTIONS=--enable-source-maps` 让主进程异常栈映射回原始 `.ts` 源文件。

## 开发工作流

### 修改代码 → CI 验证

每个逻辑单元的所有文件修改完成后，必须运行 `pnpm run ci`。该命令定义于 [package.json](../package.json)，按顺序串联：`format` → `lint:fix` → `typecheck:all` → `test:run` → `i18n:extract` → `build`。

**铁律**：`pnpm run ci` 是任务完成的最终门禁。通过标准为 lint 零错误、test 零失败、build 零报错、typecheck 零类型错误。未通过禁止标记任务完成；禁止注释测试、跳过 lint 或修改 CI 配置来让 CI 通过。详见 [00-constitution.md](../.trae/rules/00-constitution.md) 第 5 条。

### 单独运行检查

| 命令                      | 作用                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm run format`         | Prettier 全量格式化（ts/tsx/js/json/css/md/yml）                                                                  |
| `pnpm run lint`           | ESLint 检查 `src` 下 `.ts/.tsx`，配置见 [eslint.config.js](../eslint.config.js)                                   |
| `pnpm run lint:fix`       | ESLint 自动修复                                                                                                   |
| `pnpm run typecheck`      | `tsc --noEmit`，基于 [tsconfig.json](../tsconfig.json)（renderer + shared）                                       |
| `pnpm run typecheck:main` | `tsc -p tsconfig.main.json --noEmit`，基于 [tsconfig.main.json](../tsconfig.main.json)（main + preload + shared） |
| `pnpm run typecheck:all`  | 上述两个 typecheck 串联                                                                                           |
| `pnpm run test:run`       | `vitest run`，单次跑全部测试，配置见 [vitest.config.ts](../vitest.config.ts)                                      |
| `pnpm run test:coverage`  | `vitest run --coverage`，覆盖率门槛 lines/functions/statements 60%、branches 50%                                  |
| `pnpm run test:main`      | 仅跑 `src/main/**/*.test.ts`（node 环境）                                                                         |
| `pnpm run test:renderer`  | 仅跑 `src/renderer/**/*.test.ts`（jsdom 环境）                                                                    |
| `pnpm run test:shared`    | 仅跑 `src/shared/**/*.test.ts`（node 环境）                                                                       |
| `pnpm run build`          | `electron-forge package`，打包为可执行目录（不生成安装包）                                                        |
| `pnpm run i18n:extract`   | `pnpm exec i18next-cli extract`，提取 i18n key                                                                    |

## 目录约定

### 新功能放哪里

各目录的职责与归属见 [架构文档目录结构](./architecture.md#目录结构)。核心原则：新增模块必须遵循现有目录结构，禁止新建平行目录；重命名文件后同步修改所有 import 路径（见 [00-constitution.md](../.trae/rules/00-constitution.md) 第 3 条）。

### 文件命名规范

| 类型                             | 规范                                                                          | 示例                                                               |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 文件夹 / 工具函数 / 服务 / Store | kebab-case                                                                    | `file-explorer/`、`logger.ts`、`protocol-service.ts`、`session.ts` |
| React 组件                       | PascalCase.tsx                                                                | `ConnectionDialog.tsx`、`FileExplorerList.tsx`                     |
| 测试文件                         | `*.test.ts(x)`，与源文件同目录                                                | `session.test.ts`、`FileExplorerList.test.tsx`                     |
| IPC 通道常量                     | 集中在 [src/shared/constants/ipc/](../src/shared/constants/ipc/) 下按域分文件 | `protocol.ts`、`transfer.ts`                                       |

### 功能模块结构

渲染进程功能模块统一放在 [src/renderer/features/](../src/renderer/features/) 下，每个模块以 `features/<name>/` 为根，内部分为：

- `components/` — 该功能的 React 组件（PascalCase.tsx）。
- `hooks/` — 该功能专用 hooks（kebab-case.ts，如 `use-file-sort.ts`）。
- `stores/` — 该功能的 Zustand store（kebab-case.ts，导出 `use[Feature]Store`）。
- `utils/` — 该功能的纯工具函数（可选）。
- `contexts/` — 该功能的 React Context（可选）。
- `index.ts` — 模块导出入口。

参考 [src/renderer/features/session/](../src/renderer/features/session/) 作为完整示例。

## 如何新增一个 IPC 通道

按以下步骤依次完成，所有通道名必须收敛在共享常量文件中，禁止裸字符串：

1. **定义通道常量**：在 [src/shared/constants/ipc/](../src/shared/constants/ipc/) 下对应域的文件中新增通道常量（如 [protocol.ts](../src/shared/constants/ipc/protocol.ts) 的 `PROTOCOL_CHANNELS`），并从 [index.ts](../src/shared/constants/ipc/index.ts) 的 `IPC_CHANNELS` 聚合对象中导出。通道名使用 `域:动作` 格式（如 `protocol:connect`）。
2. **定义类型**：在 [src/shared/types/](../src/shared/types/) 下对应文件定义请求/响应类型，并在 [index.ts](../src/shared/types/index.ts) 导出。Result 类型使用项目内置的 `Result<T, ErrorInfo>` / `ProtocolResponse<T>`。
3. **新增 service 方法**：在 [src/main/services/](../src/main/services/) 对应 service 中实现业务逻辑。错误用 [logger](../src/main/utils/logger.ts) 记录，返回 `Result` 包装的结果。
4. **新增 IPC Handler**：在 [src/main/ipc/](../src/main/ipc/) 对应文件（如 [protocol.ts](../src/main/ipc/protocol.ts)）中通过 `ipcMain.handle` 注册。**Handler 只做透传**：仅解构参数并调用 service 方法，禁止在 Handler 内写 try-catch 或业务逻辑（业务错误由 service 返回 `Result`，系统级异常由日志捕获）。最后在 [src/main/ipc/index.ts](../src/main/ipc/index.ts) 的 `setupIpcHandlers` 中调用注册函数。新增 Handler 必须附带单元测试（见 [src/main/ipc/protocol.test.ts](../src/main/ipc/protocol.test.ts)）。
5. **新增 Preload API**：在 [src/preload/](../src/preload/) 对应文件（如 [protocol.ts](../src/preload/protocol.ts)）中通过 `ipcRenderer.invoke` 包装为独立函数。监听型通道使用 [listener-manager.ts](../src/preload/listener-manager.ts) 的 `listenerManager.on`，确保返回清理函数。最后在 [src/preload/index.ts](../src/preload/index.ts) 挂载到 `electronAPI` 命名空间。
6. **声明类型**：在 [electron-api.ts](../src/shared/types/electron-api.ts) 的对应子接口（如 `ProtocolAPI`）中追加方法签名，并保证与 preload 实现一致。
7. **渲染进程调用**：通过 `window.electronAPI.<namespace>.<method>` 调用；返回的 `Result` 用 `isErr` / `isOk` 判别。用户可见错误必须经 i18n 翻译。

## 如何新增一个功能模块

1. **创建模块目录**：在 [src/renderer/features/](../src/renderer/features/) 下新建 `<name>/`，按上文“功能模块结构”创建 `components/`、`hooks/`、`stores/` 子目录与 `index.ts`。
2. **创建 Zustand store**：在 `stores/<feature>.ts` 中用 `create` 定义 store，文件名 kebab-case，导出 `use[Feature]Store` hook。组件内必须用 selector 订阅（`useStore(s => s.xxx)`），多值用 `useShallow`。参考 [session.ts](../src/renderer/features/session/stores/session.ts)。
3. **添加 i18n key**：在 [src/renderer/i18n/locales/en-US.json](../src/renderer/i18n/locales/en-US.json) 与 [src/renderer/i18n/locales/zh-CN.json](../src/renderer/i18n/locales/zh-CN.json) 同步新增 key，命名遵循 `feature.subFeature.element` 层级。渲染进程统一用 selector API：`t($ => $.feature.key)`（i18next 已在 [config.ts](../src/renderer/i18n/config.ts) 中开启 `enableSelector: true`）。新增/修改/删除 key 后必须运行 `pnpm run i18n:extract` 并同步所有语言文件。
4. **实现组件与 hooks**：组件 PascalCase.tsx，显式定义 Props 接口；hooks kebab-case.ts。超过 500 行的组件必须拆分。列表渲染 `key` 必须是稳定唯一标识，禁止 `key={index}`。大型列表（>50 项）必须用虚拟滚动（参见 [VirtualList.tsx](../src/renderer/components/ui/VirtualList.tsx)）。
5. **集成到布局**：在 [src/renderer/layout/](../src/renderer/layout/) 或对应页面中挂载新组件；如需路由，扩展 [src/renderer/pages/](../src/renderer/pages/)。
6. **编写测试**：测试文件 `*.test.ts(x)` 与源文件同目录。UI 组件用 React Testing Library；复杂 selector 必须有测试。修改被测试覆盖的代码后同步更新测试用例。
7. **运行 CI**：完成所有文件修改后运行 `pnpm run ci` 验证。

## 如何新增一种协议

Rivet 通过 `AbstractProtocol<T>` + `ProtocolService` 支持多协议扩展，当前已实现 SFTP 与 WebDAV。新增协议按以下步骤：

1. **添加协议常量**：在 [src/shared/constants/protocol.ts](../src/shared/constants/protocol.ts) 的 `PROTOCOL` 对象中追加新协议键（如 `FTP: 'ftp'`），并同步 `ProtocolType` 类型。如需新端口，在此文件追加。
2. **继承 AbstractProtocol**：在 [src/main/services/protocol/](../src/main/services/protocol/) 下新建 `<Name>Protocol.ts`，继承 `AbstractProtocol<T>`（`T` 为该协议 client 类型）。实现 `connect` / `disconnect`，以及 `listImpl` / `mkdirImpl` / `renameImpl` / `deleteImpl` / `copyImpl` / `moveImpl` / `uploadImpl` / `downloadImpl` / `pingImpl` 等抽象方法，并实现 `getSessionInfo` / `setSessionClosing`。路径清理、超时、取消、日志由基类统一处理，子类只关注协议交互。参考 [SftpProtocol.ts](../src/main/services/protocol/SftpProtocol.ts) 与 [WebdavProtocol.ts](../src/main/services/protocol/WebdavProtocol.ts)。
3. **注册到 ProtocolService**：在 [protocol-service.ts](../src/main/services/protocol/protocol-service.ts) 的 `getProtocol()` 中追加新协议分支，实例化并缓存到 `this.protocols`。
4. **更新 ConnectionConfig 类型**：在 [connection.ts](../src/shared/types/connection.ts) 中按需扩展协议特有字段（如 `basePath`、`scheme`）。
5. **更新 ConnectionDialog**：在 [ConnectionFormFields.tsx](../src/renderer/features/session/components/ConnectionFormFields.tsx) 的协议下拉选项中追加新协议，并在 [ConnectionDialog.tsx](../src/renderer/features/session/components/ConnectionDialog.tsx) 中处理新协议的默认端口与表单字段显隐。
6. **编写测试**：在同级目录新增 `<Name>Protocol.test.ts`，覆盖各 `*Impl` 方法与异常分支。运行 `pnpm run ci` 验证。

## 调试技巧

### 主进程日志

主进程使用 [src/main/utils/logger.ts](../src/main/utils/logger.ts) 导出的 `logger`（基于 `electron-log/main`）。导入方式：`import { logger } from '@main/utils/index.js'`。可用方法：`logger.info(msg, ...args)`、`logger.warn`、`logger.error`、`logger.debug`、`logger.catch(error, context?)`（用于捕获异常并附带上下文）。

日志文件路径由 `log.transports.file.resolvePathFn` 设置为 `app.getPath('userData')/logs/main.log`，文件与控制台 transport 均为 `info` 级别。开发模式下日志会附加调用方源文件信息（由 `getCallerInfo` 提供）。**禁止在主进程使用 `console.error`**（被 ESLint `no-console: error` 规则拦截），所有错误必须走 logger。

### 渲染进程 DevTools

开发模式下在主窗口按 `Ctrl+Shift+I`（Windows/Linux）或 `Cmd+Option+I`（macOS）打开 DevTools。

### 渲染进程日志

渲染进程使用 [src/renderer/utils/logger.ts](../src/renderer/utils/logger.ts) 默认导出的 `logger`（基于 `electron-log/renderer`），日志会自动转发到主进程并写入同一份 `main.log`。生产环境禁止 `console.log`（ESLint `no-console: error`），所有日志走 logger。

### Sentry

主进程与渲染进程均初始化 Sentry：

- 主进程：[src/main/app/main.ts](../src/main/app/main.ts) 调用 `Sentry.init`，仅在生产环境且配置了 `SENTRY_DSN` 时启用，`sendDefaultPii: false`。
- 渲染进程：[src/renderer/sentry.ts](../src/renderer/sentry.ts) 在生产环境且配置了 `VITE_SENTRY_DSN` 时初始化。

### 测试

测试命令见上文“单独运行检查”表格。测试配置见 [vitest.config.ts](../vitest.config.ts) 与 [vitest.setup.ts](../vitest.setup.ts)：默认 jsdom 环境，globals 开启（可直接用 `describe/it/expect`），setup 文件全局 mock 了 `i18next` / `react-i18next` / `matchMedia` / `ResizeObserver`。Electron 依赖在测试中被 alias 重定向到 mock 模块，位于 [src/shared/test-utils/mocks/](../src/shared/test-utils/mocks/)：

| Mock 文件                                                                           | 替换目标                |
| ----------------------------------------------------------------------------------- | ----------------------- |
| [electron.ts](../src/shared/test-utils/mocks/electron.ts)                           | `electron`              |
| [electron-log-main.ts](../src/shared/test-utils/mocks/electron-log-main.ts)         | `electron-log/main`     |
| [electron-log-renderer.ts](../src/shared/test-utils/mocks/electron-log-renderer.ts) | `electron-log/renderer` |
| [electron-store.ts](../src/shared/test-utils/mocks/electron-store.ts)               | `electron-store`        |

测试文件命名 `*.test.ts(x)`，与源文件同目录。覆盖率门槛：lines/functions/statements ≥ 60%，branches ≥ 50%。

## 构建与打包

### 构建

`pnpm run build` 等价于 `electron-forge package`，由 [forge.config.ts](../forge.config.ts) 编排，使用 `@electron-forge/plugin-vite` 驱动三个 Vite 构建：

| Vite 配置                                             | 入口                    | 输出目录                      | 格式 | 关键点                                                                                                                                                  |
| ----------------------------------------------------- | ----------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [vite.main.config.ts](../vite.main.config.ts)         | `src/main/app/main.ts`  | `.vite/build/main.js`         | ES   | 开启 sourcemap，external 化 electron / ssh2-sftp-client / webdav / electron-log/main / electron-store / @sentry/electron/main                           |
| [vite.preload.config.ts](../vite.preload.config.ts)   | `src/preload/index.ts`  | `.vite/build/index.cjs`       | CJS  | external 化 electron，`exports: 'none'`                                                                                                                 |
| [vite.renderer.config.ts](../vite.renderer.config.ts) | `src/renderer/`（root） | `.vite/renderer/main_window/` | ES   | 启用 React Compiler（babel-plugin-react-compiler）与 Tailwind 4（`@tailwindcss/vite`），手动分包：vendor-react / vendor-i18n / vendor-ui / vendor-utils |

类型检查基于两份 tsconfig：

| tsconfig                                    | 覆盖范围                                         | 关键配置                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tsconfig.json](../tsconfig.json)           | `src/renderer/**`、`src/shared/**`               | `strict`、`verbatimModuleSyntax`、`erasableSyntaxOnly`、`allowImportingTsExtensions`、`rewriteRelativeImportExtensions`、paths 别名 `@/*`、`@renderer/*`、`@shared/*` |
| [tsconfig.main.json](../tsconfig.main.json) | `src/main/**`、`src/shared/**`、`src/preload/**` | 同上，额外支持 `@main/*`、`@preload/*` 别名；`exclude` 排除 `src/shared/test-utils/**/*`                                                                              |

打包配置：[forge.config.ts](../forge.config.ts) 中 `packagerConfig` 设置 `appId: com.rivet.app`、`name: Rivet`、`asar: true`，图标为 `assets/icon`。Makers 包括 `maker-zip`（全平台）、`maker-deb`（linux）、`maker-dmg`（darwin）。

### 打包

| 命令                             | 平台 / 架构                           |
| -------------------------------- | ------------------------------------- |
| `pnpm run package`               | 当前宿主平台（`electron-forge make`） |
| `pnpm run package:win`           | win32 x64 + arm64                     |
| `pnpm run package:win:x64`       | win32 x64                             |
| `pnpm run package:win:arm64`     | win32 arm64                           |
| `pnpm run package:linux`         | linux x64 + arm64                     |
| `pnpm run package:linux:x64`     | linux x64                             |
| `pnpm run package:linux:arm64`   | linux arm64                           |
| `pnpm run package:mac`           | darwin x64 + arm64 + universal        |
| `pnpm run package:mac:x64`       | darwin x64                            |
| `pnpm run package:mac:arm64`     | darwin arm64                          |
| `pnpm run package:mac:universal` | darwin universal                      |

打包产物输出到 `release/` 目录（已被 [.gitignore](../.gitignore) 忽略）。

## 编码规范要点

完整规范见 [.trae/rules/](../.trae/rules/)，以下为关键要点摘要：

- **TypeScript**（[01-typescript.md](../.trae/rules/01-typescript.md)）：`strict` / `noImplicitAny` / `strictNullChecks` 不可关闭；禁止 enum（用 `as const` 对象）、禁止参数属性、禁止裸 `as` 与非空 `!` 断言；必须启用 `verbatimModuleSyntax` 与 `erasableSyntaxOnly`；优先使用 Node.js subpath imports。
- **React**（[02-react.md](../.trae/rules/02-react.md)）：React 19+ —— `ref` 作为普通 prop，禁止 `forwardRef`；Context 直接作 Provider（`<MyContext>`）；依赖 React Compiler 自动 memoization，禁止无意义的手动 `useMemo`/`useCallback`；`useEffect` 依赖数组引用的函数/对象必须有稳定引用；列表 `key` 必须稳定唯一；超过 500 行的组件必须拆分；应用必须有顶层 Error Boundary。
- **Zustand**（[03-zustand.md](../.trae/rules/03-zustand.md)）：store 文件 kebab-case，导出 `use[Feature]Store` hook；组件内必须用 selector，多值用 `useShallow`；状态更新走 `set()`/`get()`；`persist` 配合 `createJSONStorage`，中间件组合顺序 `immer → persist → devtools`。
- **Tailwind CSS 4**（[04-tailwind.md](../.trae/rules/04-tailwind.md)）：配置在 CSS 中用 `@theme`，无 `tailwind.config.js`；入口 `@import "tailwindcss"`；Vite 集成用 `@tailwindcss/vite`；复杂条件类名用 `tailwind-merge` + `clsx`；交互元素必须有 `focus-visible:` 样式，图标按钮必须有 `aria-label`。
- **i18next 26**（[05-i18next.md](../.trae/rules/05-i18next.md)）：UI 文本禁止硬编码，必须用 selector API `t($ => $.feature.subFeature.element)`；key 命名 `feature.subFeature.element` 层级；`init()` 必须开启 `enableSelector: true`；日期/数字用 `Intl.*` 配合 `i18next.services.formatter.add()`，禁止 `interpolation.format` 回调（i18next 26 已移除）；新增/修改/删除 key 后同步所有语言文件。
- **Electron**（[06-electron.md](../.trae/rules/06-electron.md)）：渲染进程 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；`app.whenReady()` 前调用 `app.enableSandbox()`；IPC 通道名在共享常量文件定义；IPC Handler 与 Preload 只做透传，业务委托给 services；Preload API 白名单化，每个 IPC 调用包装为独立函数；拦截 `will-navigate`、`setWindowOpenHandler`，`setPermissionRequestHandler` 拒绝所有权限；生产环境 CSP 禁止 `unsafe-inline` 脚本和 `unsafe-eval`；敏感数据用 `safeStorage`，禁止写入 localStorage。
