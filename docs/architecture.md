# Rivet 架构文档

Rivet 是一个基于 Electron 的 SFTP/WebDAV 文件浏览器，使用 React 19 + TypeScript 6 + Zustand 5 + Tailwind CSS 4 构建，支持双协议远程文件管理、并发传输队列、主机密钥验证、加密密码持久化与多窗口工作流。

[开发指南](./development-guide.md) | [IPC 参考](./ipc-reference.md) | [Store 参考](./store-reference.md)

## 技术栈

下表所列版本号均来自 [package.json](../package.json) 的实际声明，`^` 表示允许次版本升级。

| 技术                                                      | 用途                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Electron ^43.2.0                                          | 跨平台桌面外壳，主进程承载文件/网络/加密等原生能力                         |
| React ^19.2.8                                             | 渲染层 UI 框架，启用 React Compiler 自动 memoization                       |
| TypeScript ^6.0.3                                         | 全量类型安全，启用 `strict`、`verbatimModuleSyntax`、`erasableSyntaxOnly`  |
| Zustand ^5.0.14                                           | 渲染进程状态管理（UI、连接、会话、传输）                                   |
| Tailwind CSS ^4.3.3                                       | 原子化样式，通过 `@theme` 在 CSS 中配置主题令牌                            |
| i18next ^26.3.6 + react-i18next ^17.0.11                  | 国际化，启用 selector API                                                  |
| Vite ^8.1.5                                               | 主进程/Preload/渲染进程统一构建工具（@electron-forge/plugin-vite ^7.11.2） |
| Vitest ^4.1.10                                            | 单元测试，主进程用 node 环境，渲染层用 jsdom ^29.1.1                       |
| @radix-ui（dialog/menu/select/toast 等 ^1.x）             | 无障碍基础组件                                                             |
| @dnd-kit/core ^6.3.1 + @dnd-kit/sortable ^10.0.0          | 连接列表拖拽排序                                                           |
| react-window ^2.3.0 + react-virtualized-auto-sizer ^2.0.3 | 大型文件列表虚拟滚动                                                       |
| react-resizable-panels ^4.12.2                            | 侧栏/队列抽屉可调宽度                                                      |
| p-limit ^7.3.1                                            | 传输并发与文件夹统计并发限流                                               |
| lucide-react ^1.26.0                                      | 图标库                                                                     |
| electron-log ^5.4.4                                       | 主进程日志写入文件                                                         |
| electron-store ^11.0.2                                    | 配置与已知主机持久化                                                       |
| ssh2-sftp-client ^12.1.1                                  | SFTP 协议底层客户端                                                        |
| webdav ^5.10.0                                            | WebDAV 协议底层客户端                                                      |
| @sentry/electron ^7.15.0                                  | 生产环境崩溃上报                                                           |
| babel-plugin-react-compiler ^1.0.0（dev）                 | React Compiler 编译期 memoization                                          |
| clsx ^2.1.1 + tailwind-merge ^3.6.0                       | 条件类名合并                                                               |

## 整体架构

Rivet 采用 Electron 三进程 + Shared 共享层的经典分层架构。所有进程共享同一份 TypeScript 类型与常量；业务逻辑只存在于主进程 services 层；IPC 与 Preload 仅做透传；渲染进程只持有 UI 状态并通过 `window.electronAPI` 调用主进程。

- 渲染进程（React）：承载 [App.tsx](../src/renderer/App.tsx) 及 features 模块，管理 UI 状态（Zustand）、i18n、主题、快捷键、虚拟列表、拖拽，所有原生操作通过 `window.electronAPI.*` 委托主进程。
- Preload 层：通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露白名单 API，使用 [listener-manager.ts](../src/preload/listener-manager.ts) 集中注册 `ipcRenderer.on` 监听并在 `beforeunload` 自动清理；不包含任何业务逻辑。
- 主进程（Electron）：负责窗口生命周期、IPC handler、协议抽象、传输引擎、会话管理、配置持久化、加密与日志。入口 [main.ts](../src/main/app/main.ts) → [index.ts](../src/main/app/index.ts) → [lifecycle.ts](../src/main/app/lifecycle.ts) → [window-factory.ts](../src/main/app/window-factory.ts)。
- Shared 层：[src/shared/constants](../src/shared/constants/index.ts) 与 [src/shared/types](../src/shared/types/index.ts) 跨进程复用，包含 IPC 通道名、错误码、超时、协议状态、Result/ProtocolResponse/ErrorInfo 等纯类型与常量。

## 目录结构

仓库根目录为 `c:\demo\Rivet`，主要源码集中在 `src/`，按进程拆分子目录。

- [src/main](../src/main) — 主进程
  - [app/](../src/main/app) — 入口与窗口：[main.ts](../src/main/app/main.ts) 启动并注册全局 IPC 与 CSP，[lifecycle.ts](../src/main/app/lifecycle.ts) 应用退出与崩溃清理，[window-factory.ts](../src/main/app/window-factory.ts) 无边框窗口工厂与 `WindowManager`。
  - [services/](../src/main/services) — 业务服务
    - [protocol/](../src/main/services/protocol) — 协议抽象层：[abstract-protocol.ts](../src/main/services/protocol/abstract-protocol.ts) 模板基类、[protocol-service.ts](../src/main/services/protocol/protocol-service.ts) 门面、[SftpProtocol.ts](../src/main/services/protocol/SftpProtocol.ts)、[WebdavProtocol.ts](../src/main/services/protocol/WebdavProtocol.ts)、[protocol-types.ts](../src/main/services/protocol/protocol-types.ts) 接口定义。
    - [transfer/](../src/main/services/transfer) — 传输引擎：[transfer-service.ts](../src/main/services/transfer/transfer-service.ts) 入口、[transfer-scheduler.ts](../src/main/services/transfer/transfer-scheduler.ts) 调度、[transfer-progress.ts](../src/main/services/transfer/transfer-progress.ts) 速度与节流、[transfer-cancellation.ts](../src/main/services/transfer/transfer-cancellation.ts) 取消/重试、[transfer-context.ts](../src/main/services/transfer/transfer-context.ts) 上下文接口与目录展开、[download-executor.ts](../src/main/services/transfer/download-executor.ts) 与 [upload-executor.ts](../src/main/services/transfer/upload-executor.ts) 方向执行器。
    - [session-registry.ts](../src/main/services/session-registry.ts) — `Map<sessionId, SessionHandle>` 注册表。
    - [session-manager.ts](../src/main/services/session-manager.ts) — 心跳、安全断开、批量清理。
  - [ipc/](../src/main/ipc) — 9 个 IPC handler 文件，[index.ts](../src/main/ipc/index.ts) 统一装配。
  - [stores/](../src/main/stores) — 配置持久化：[config/store.ts](../src/main/stores/config/store.ts) 内存缓存 + electron-store，[config/persistence.ts](../src/main/stores/config/persistence.ts) 加载/刷盘/自动保存，[config/validation.ts](../src/main/stores/config/validation.ts) 校验，[config/types.ts](../src/main/stores/config/types.ts) `StoreSchema`，[config/ui-settings.ts](../src/main/stores/config/ui-settings.ts) 默认 UI 设置，[known-hosts.ts](../src/main/stores/known-hosts.ts) 独立的主机密钥存储。
  - [utils/](../src/main/utils) — [logger.ts](../src/main/utils/logger.ts) electron-log 封装，[encryption.ts](../src/main/utils/encryption.ts) safeStorage + HMAC 加密。
- [src/preload](../src/preload) — Preload 脚本：[index.ts](../src/preload/index.ts) 暴露 `electronAPI`，[listener-manager.ts](../src/preload/listener-manager.ts) 监听器集中管理，其余按域划分（config/crypto/dialog/host-key/protocol/system/transfer/window）。
- [src/renderer](../src/renderer) — 渲染进程
  - [App.tsx](../src/renderer/App.tsx) 顶层组件，挂载初始化、主题、全局快捷键 hooks。
  - [layout/MainLayout.tsx](../src/renderer/layout/MainLayout.tsx) 与 [layout/ActivityBar.tsx](../src/renderer/layout/ActivityBar.tsx) 主窗口骨架。
  - [pages/](../src/renderer/pages) — `ConnectionPage` 与 `TransferPage`，通过 `useUiStore.activeView` 切换。
  - [features/](../src/renderer/features) — 业务模块：`file-explorer`（文件浏览/操作）、`session`（连接与会话）、`transfer`（传输队列）、`host-key`（主机密钥对话）。
  - [stores/](../src/renderer/stores) — Zustand stores：[ui.ts](../src/renderer/stores/ui.ts) 全局 UI。
  - [hooks/](../src/renderer/hooks) — 应用初始化、主题、i18n、全局快捷键、活跃任务守卫等。
  - [i18n/](../src/renderer/i18n) — `config.ts` 与 `locales/en-US.json`、`locales/zh-CN.json`。
  - [components/](../src/renderer/components) — 通用组件（`common` 业务通用，`ui` 基础控件）。
- [src/shared](../src/shared) — 跨进程共享
  - [constants/](../src/shared/constants) — `app.ts`、`error-code.ts`、`i18n.ts`、`protocol.ts`、`protocol-status.ts`、`timeouts.ts`、`transfer.ts`、`ui.ts`、`sort.ts`，以及 [ipc/](../src/shared/constants/ipc) 子目录按域拆分的通道名。
  - [types/](../src/shared/types) — `result.ts`、`protocol-request.ts`、`operation-result.ts`、`connection.ts`、`session.ts`、`file.ts`、`transfer.ts`、`settings.ts`、`host-key.ts`、`electron-api.ts`、`folder-stats.ts`、`host-key-dialog.ts`。
- [docs/](.) — 本目录，含 [development-guide.md](./development-guide.md)、[ipc-reference.md](./ipc-reference.md)、[store-reference.md](./store-reference.md)。

## 进程职责

### 主进程

启动流程在 [main.ts](../src/main/app/main.ts) 中按固定顺序执行：

1. 初始化 Sentry（仅生产环境且配置了 `SENTRY_DSN`）。
2. `app.setName(APP_NAME)` 与 `app.enableSandbox()`，确保渲染进程沙箱在 `whenReady` 前启用。
3. 在 `app.whenReady()` 回调中：
   - 通过 `session.defaultSession.setPermissionRequestHandler` 拒绝所有权限请求。
   - 通过 `session.defaultSession.webRequest.onHeadersReceived` 注入 CSP，生产环境 `script-src 'self'`，开发环境放宽以支持 Vite HMR（`'unsafe-inline' 'unsafe-eval'` 与 `ws://localhost:*`）。
   - `initializeConfig()` 从 electron-store 读取并校验配置写入内存缓存。
   - `startAutoSave()` 启动 `TIMEOUTS.AUTO_SAVE_INTERVAL`（5 分钟）定时刷盘。
   - `setupIpcHandlers()` 注册 9 个域的 IPC handler。
   - `createMainWindow()` 通过 `WindowManager.create` 创建主窗口，并向 `transferService` 与 `protocolService` 注入窗口实例用于向渲染进程广播事件。
4. `setupAppLifecycle()` 注册窗口与进程生命周期钩子（[lifecycle.ts](../src/main/app/lifecycle.ts)）：
   - `window-all-closed` 在非 macOS 退出应用。
   - `before-quit` 拦截退出：若 `transferService.hasActiveTasks()` 为真，阻止退出并向渲染进程发送 `TRANSFER_CHANNELS.HAS_ACTIVE_TASKS` 触发确认弹窗；否则异步执行 `stopAutoSave → disconnectAllSessions → saveConfig`，并以 `TIMEOUTS.FORCE_EXIT`（10 秒）作为强制退出兜底。
   - `uncaughtException` 记录日志后 `cleanupAndExit('uncaughtException', false, 1)`（不保存配置以避免写入损坏数据）。
   - `unhandledRejection` 仅记录日志。
   - `SIGTERM`/`SIGINT` 调用 `cleanupAndExit` 并保存配置。
5. `createMainWindow` 还会为窗口挂上 `interceptCloseIfActive`：`close` 事件被拦截时通知渲染进程弹窗确认。

### Preload 层

[src/preload/index.ts](../src/preload/index.ts) 通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露 8 个域的 API：`protocol`、`config`、`dialog`、`hostKey`、`system`、`crypto`、`window`、`transfer`。每个域内的方法都是对 `ipcRenderer.invoke` 或 `ipcRenderer.send` 的薄包装，并附带类型签名。

非 IPC 能力由 [listener-manager.ts](../src/preload/listener-manager.ts) 提供：`ListenerManager.on(channel, handler)` 返回取消订阅函数，并在 `window.beforeunload` 时统一 `removeListener`，保证窗口关闭时所有 `ipcRenderer.on` 监听器被清理。Preload 不包含任何业务逻辑，所有调用都是透传到主进程。

### 渲染进程

[src/renderer/App.tsx](../src/renderer/App.tsx) 顶层挂载三个全局 hooks（`useApplicationInitialization`、`useApplicationTheme`、`useGlobalShortcuts`），并在 `useUiStore.initialized` 为 false 时显示 loading 文案；初始化完成后渲染 [MainLayout.tsx](../src/renderer/layout/MainLayout.tsx)。

`MainLayout` 由 `TitleBar` + `ActivityBar` + `PageContent` + `Toast` + `ConfirmationDialog` 组成。`PageContent` 根据 `useUiStore.activeView` 在 `ConnectionPage` 与 `TransferPage` 之间切换。`ActivityBar` 提供两个 `SIDEBAR_VIEW` 切换按钮（`CONNECTIONS` / `TRANSFERS`）。

feature 模块组织：

- `features/session` — 连接列表、连接对话框、会话连接/断开 hooks、连接 store。
- `features/file-explorer` — 文件列表、面包屑、上下文菜单、重命名/删除/复制/移动/创建文件夹 hooks、冲突对话框、目录导航。
- `features/transfer` — 传输任务列表、进度条、冲突解决、排序、批量进度 store。
- `features/host-key` — 主机密钥验证对话框与通知。

## IPC 通信模式

Rivet 的 IPC 通信采用三层透传模式：

1. 渲染进程调用 `window.electronAPI.<domain>.<method>(...)`。
2. Preload 文件以 `ipcRenderer.invoke(IPC_CHANNELS.<DOMAIN>.<CHANNEL>, ...args)` 形式透传到主进程，IPC 通道名在 [src/shared/constants/ipc/](../src/shared/constants/ipc) 下按域集中定义，禁止裸字符串。
3. 主进程 [src/main/ipc/](../src/main/ipc) 内的 handler 仅做参数转发到对应 service 方法，不写业务逻辑。

通信分三个方向：`invoke`（渲染→主进程，返回 Promise）、`send`（渲染→主进程，单向无返回）、`on`（主进程→渲染，事件推送）。方向标记说明与各通道的完整清单见 [IPC 参考](./ipc-reference.md)。

核心原则：[src/main/ipc/protocol.ts](../src/main/ipc/protocol.ts) 等所有 handler 文件只做参数解构与方法委托，例如 `PROTOCOL.LIST` handler 直接调用 `protocolService.list(sessionId, remotePath, requestId)` 并返回 `ProtocolResponse<FileInfo[]>`，不做任何分支处理或错误转换。

## 协议抽象层

协议层通过模板方法模式实现，自顶向下分为三层：

- [protocol-types.ts](../src/main/services/protocol/protocol-types.ts) 定义 `FileProtocol` 接口，声明 `connect`、`disconnect`、`list`、`mkdir`、`rename`、`delete`、`copy`、`move`、`upload`、`download`、`ping` 共 11 个方法，全部返回 `Result<T, ErrorInfo>` 或 `Promise<Result<T, ErrorInfo>>`。同时定义 `SessionInfo`、`HostVerifier`、`HostVerifierResult`。
- [abstract-protocol.ts](../src/main/services/protocol/abstract-protocol.ts) 提供 `AbstractProtocol<T>` 抽象基类（泛型 `T` 为底层 client 类型），实现通用流程并声明抽象方法 `*Impl` 由子类实现。
- [SftpProtocol.ts](../src/main/services/protocol/SftpProtocol.ts) 与 [WebdavProtocol.ts](../src/main/services/protocol/WebdavProtocol.ts) 继承 `AbstractProtocol` 并实现 `*Impl`，分别包装 `ssh2-sftp-client` 的 `Client` 与 `webdav` 的 `WebDAVClient`。

模板方法流程（以 `list` 为例）：

1. 公开 `list(sessionId, path, signal)` 调用 `runSinglePathOp`。
2. `runSinglePathOp` 调用 `sanitizePathOrError`（基于 [src/shared/utils](../src/shared/utils) 的 `sanitizePath` 拦截路径穿越），失败则返回 `PATH_TRAVERSAL` 错误。
3. `runPathOp` 调用 `executePathOperation`，后者通过 `getClient(sessionId)` 拿到 client（缺失返回 `SESSION_NOT_FOUND`，正在关闭返回 `SESSION_CLOSING`），并 `normalizePath` 计算 basePath。
4. `withAbort` 包裹 `*Impl` 调用：监听 `signal.aborted`、可选 `timeout` 触发 `*_TIMEOUT` 错误、abort 时返回 `*_ABORTED` 错误。
5. `executePathOperation` 在 try/catch 中调用 impl，失败时 `logger.catch` 写日志并返回 `INVALID_STATE`；成功时（除 `LIST` 外）`logger.info` 记录。
6. 子类 `listImpl` 直接调用底层 client，错误转换为对应 `*_ERROR` 错误码。

`AbstractProtocol` 还提供 `runDualPathOp`（双路径操作，如 `rename`、`copy`、`move`）与 `executeTransferOperation`（传输操作，额外创建 `AbortController` 并在信号 abort 时级联取消底层流）。`upload`/`download` 在 abort 后会删除远程残留文件或本地临时文件。

[protocol-service.ts](../src/main/services/protocol/protocol-service.ts) 是 `ProtocolService` 门面类：

- 持有 `protocols: Map<ProtocolType, FileProtocol>` 懒加载 `SftpProtocol` / `WebdavProtocol` 实例。
- `connect` 解密 `config.password`，构造 SFTP 的 `hostVerifier` 闭包（读取 `known-hosts` 存储比对 hash），调用 `protocol.connect`。
- `executeWithRequest` / `executeWithProtocol` 是核心包装器：生成 `requestId`、创建 `AbortController`、设置可选 `timeout`、登记到 `activeRequests`、捕获 `AbortError` 转换为 `REQUEST_ABORTED`，并最终返回 `ProtocolResponse<T>`。
- `cancel(requestId)` 通过 `activeRequests` 查找 controller 并 abort。
- `calculateFolderStats` 使用 `pLimit(STATS_CONCURRENCY)`（5）并发递归遍历目录，通过 `IPC_CHANNELS.PROTOCOL.FOLDER_STATS_PROGRESS` 推送进度。
- `setHasActiveTasksChecker` 注入传输层活跃任务检查回调，避免协议层反向依赖传输层；`disconnect` 在有活跃任务时返回 `UPLOAD_IN_PROGRESS` 错误。

## 传输引擎

[src/main/services/transfer/](../src/main/services/transfer) 实现并发传输队列。

- [transfer-service.ts](../src/main/services/transfer/transfer-service.ts) 是 `TransferService` 入口类，实现 `TransferContext` 接口，持有 `tasks`、`operations`、`operationsByTask`、`abortControllers`、`speedSamples`、`opSpeedSamples`、`lastProgressTime`、`lastOpProgressTime`、`folderRunningOps`、`cancelledTaskIds`、`lastDirs` 等状态。导出单例 `transferService`。
- [transfer-context.ts](../src/main/services/transfer/transfer-context.ts) 定义 `TransferContext` 接口与 `expandDirectory` 通用目录展开函数，通过 `DirectoryExpanderStrategy` 区分上传（读本地目录）与下载（读远程目录）。常量 `TEMP_FILE_SUFFIX = '.rivet-download'` 用于下载临时文件后缀。
- [transfer-scheduler.ts](../src/main/services/transfer/transfer-scheduler.ts) 负责调度：`scheduleTasks` 按方向（UPLOAD/DOWNLOAD）独立调度，每个方向最大并发由 `getConcurrency(direction)` 决定；`scheduleFolderOps` 调度文件夹任务下的子操作；`createInitialOperations` 为文件夹任务创建首个 `MKDIR` 操作。
- [transfer-progress.ts](../src/main/services/transfer/transfer-progress.ts) 实现速度采样与节流：`SpeedSample` 包含 `timestamp` 与 `transferredSize`，采样窗口 `SPEED_WINDOW_MS = 3000`，最少样本 `SPEED_MIN_SAMPLES = 2`；`shouldThrottle` 基于 `TRANSFER_CONFIG.PROGRESS_THROTTLE_MS`（500ms）节流；`buildProgressData` 组装 `TransferProgressData`；`getActiveOperationInfos` 返回文件夹任务下活跃与最近完成的操作（最多 `MAX_INLINE_OPERATIONS = 3`）。
- [transfer-cancellation.ts](../src/main/services/transfer/transfer-cancellation.ts) 实现 `cancel` / `cancelAll` / `retry` / `retryAll`：根据任务状态分派 `cancelWaitingTask` / `cancelRunningTask` / `cancelFinishedTask`，取消时清理临时文件、abort 运行中操作、从 `cancelledTaskIds` 标记。
- [download-executor.ts](../src/main/services/transfer/download-executor.ts) 与 [upload-executor.ts](../src/main/services/transfer/upload-executor.ts) 实现方向相关执行器：`executeDownloadFile` 先写入 `*.rivet-download` 临时文件，成功后 `fs.rename` 为最终路径，失败删除残留；`executeDownloadFolderOp` / `executeUploadFolderOp` 处理 `MKDIR` 与文件传输操作，并调用 `expandDirectory` 递归展开子目录。

并发与配置：`getConcurrency` 从内存配置 `STORE_KEY.TRANSFER_SETTINGS` 读取 `maxUploadConcurrency` / `maxDownloadConcurrency`，`setConcurrency` 在 `TRANSFER_CONFIG.MIN_CONCURRENCY`（1）到 `MAX_CONCURRENCY`（10）之间限流并触发重新调度。默认并发为 `DEFAULT_CONCURRENCY`（5）。

传输状态机：每个 `TransferTask` 与 `UploadOperation` 的 `status` 字段取自 [transfer.ts](../src/shared/constants/transfer.ts) 的 `OPERATION_STATUS`：

| 状态        | 触发                                       | 行为                                                                                                       |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `WAITING`   | `addTasks` 入队 / `retry` 重置             | 等待调度器选中                                                                                             |
| `RUNNING`   | `scheduleTasks` / `scheduleFolderOps` 选中 | 增加 `runningUploadTasks` / `runningDownloadTasks` 或 `folderRunningOps` 计数                              |
| `COMPLETED` | impl 成功返回                              | 单文件任务直接发送 `TASK_COMPLETED` 并 `removeTask`；文件夹任务在 `checkTaskCompletion` 中等所有子操作完成 |
| `FAILED`    | impl 返回 `isErr` 或抛异常                 | `failOperation` / `failTaskAndCleanup` 设置 `errorMessage`，取消同任务其他运行中操作，发送 `TASK_FAILED`   |

渲染进程同步：`send(channel, data)` 通过 `mainWindow.webContents.send` 推送事件，通道包括 `TRANSFER_CHANNELS.PROGRESS`、`TASKS_ENQUEUED`、`TASK_COMPLETED`、`TASK_FAILED`、`TASK_REMOVED`。`throttledSendProgress` 在 `shouldThrottle` 返回 false 时调用 `markProgressSent` 并 `sendProgress`。

## 会话管理

[src/main/services/session-registry.ts](../src/main/services/session-registry.ts) 定义 `SessionRegistry` 与 `SessionHandle<T>`：

- `sessions: Map<string, SessionHandle<unknown>>` 存储 `client`、`config`、`protocolType`、`isClosing`。
- `register<T>` / `unregister` / `get<T>` / `has` / `getAllIds` / `count` / `setClosing` / `clear`。
- 导出单例 `sessionRegistry`。

[src/main/services/session-manager.ts](../src/main/services/session-manager.ts) 定义 `SessionManager` 类，构造时注入 `disconnect` 与 `ping` 回调；导出 `SessionManager` 类（不导出实例，由调用方组合）。

连接流程：

1. 渲染进程调用 `window.electronAPI.protocol.connect(config)`。
2. [protocol-service.ts](../src/main/services/protocol/protocol-service.ts) `connect` 解密密码，调用 `SftpProtocol.connect` 或 `WebdavProtocol.connect`。
3. 协议实现 `connect` 成功后调用 `sessionRegistry.register(sessionId, client, config, protocolType)`。
4. 主进程 IPC handler 返回 `ProtocolResponse<OperationResult>`，包含 `sessionId` 与 `statusCode`。

主机密钥验证流程（仅 SFTP）：

1. `ProtocolService.connect` 构造 `hostVerifier` 闭包，闭包内调用 `getHostKeyRecord(config.id)` 读取 [known-hosts.ts](../src/main/stores/known-hosts.ts)。
2. 无记录返回 `ProtocolStatus.FIRST_CONNECT`（2001），并附带当前 hash 让用户确认。
3. hash 一致返回 `ProtocolStatus.OK`（2000）。
4. hash 不一致返回 `SftpStatus.HOST_KEY_MISMATCH`（3000），并附带 `previousHash`。
5. `SftpProtocol.connect` 把 `hostVerifier` 包装成 ssh2 的 `hostVerifier` 回调；若返回 `HOST_KEY_MISMATCH`，则 `connect` 不抛异常而是返回 `ok({ sessionId: '', statusCode: HOST_KEY_MISMATCH, detail })`，由渲染进程弹出 `HostKeyVerificationDialog` 让用户决定是否信任并保存新密钥。

心跳：`SessionManager` 在首次 `register` 后启动 `setInterval(TIMEOUTS.HEARTBEAT_INTERVAL)`（30 秒）调用 `checkAllSessions`，对每个非 `isClosing` 的会话执行 `callbacks.ping(sessionId)`，超时 `TIMEOUTS.PING`（5 秒）后调用 `safeUnregister` 并通过 `WindowManager.broadcast(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, ...)` 通知所有窗口。

安全断开：`safeUnregister(sessionId)` 检查 `transferService.hasActiveTasks(sessionId)`（有活跃任务返回 `UPLOAD_IN_PROGRESS`），标记 `isClosing`，然后 `Promise.race` 执行 `disconnect` 与 `TIMEOUTS.DISCONNECT`（5 秒）超时，最终 `unregister`。`safeUnregisterAll` 使用 `Promise.allSettled` 批量清理所有会话并 `destroy()` 心跳。

## 状态驱动导航

[src/renderer/stores/ui.ts](../src/renderer/stores/ui.ts) 的 `useUiStore` 持有 `activeView: SidebarView`，初始值为 `SIDEBAR_VIEW.CONNECTIONS`。`setActiveView` 通过 `set({ activeView })` 更新。

[MainLayout.tsx](../src/renderer/layout/MainLayout.tsx) 中 `PageContent` 根据 `activeView` 渲染 `ConnectionPage` 或 `TransferPage`；切换时通过 React 条件渲染卸载另一页面，避免同时挂载。`ActivityBar` 提供 `CONNECTIONS` / `TRANSFERS` 两个按钮。

子窗口由 [window-factory.ts](../src/main/app/window-factory.ts) 的 `WindowManager` 管理：`WindowManager.create(options)` 接受 `id`、`route`、尺寸、`parent`、`modal` 等参数，复用 `createFramelessWindow` 创建无边框窗口，注册到内部 `windowMap: Map<string, BrowserWindow>`，并 `registerWindowMeta` 关联 `windowId` 与 `route`。`WindowManager.broadcast` 可向所有存活窗口广播事件；`closeBySender`、`minimize`、`maximize`、`getState`、`getMeta` 通过 `BrowserWindow.fromWebContents(sender)` 反查窗口，避免渲染进程显式传 windowId。

## 安全基线

下表汇总自 [main.ts](../src/main/app/main.ts) 与 [window-factory.ts](../src/main/app/window-factory.ts)：

| 措施                        | 实现位置                                                                                                          | 说明                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| contextIsolation            | [window-factory.ts](../src/main/app/window-factory.ts) `webPreferences.contextIsolation: true`                    | Preload 与渲染上下文隔离                                            |
| nodeIntegration             | `webPreferences.nodeIntegration: false`                                                                           | 渲染进程不暴露 Node.js API                                          |
| sandbox                     | `app.enableSandbox()` + `webPreferences.sandbox: true`                                                            | 渲染进程沙箱化                                                      |
| CSP                         | [main.ts](../src/main/app/main.ts) `onHeadersReceived` 注入 `Content-Security-Policy`                             | 生产环境 `script-src 'self'`，禁用 `unsafe-inline` / `unsafe-eval`  |
| will-navigate               | [window-factory.ts](../src/main/app/window-factory.ts) `webContents.on('will-navigate')` `event.preventDefault()` | 阻止任何导航                                                        |
| setWindowOpenHandler        | `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`                                                    | 拒绝任何新窗口打开                                                  |
| setPermissionRequestHandler | [main.ts](../src/main/app/main.ts) `session.defaultSession.setPermissionRequestHandler` `callback(false)`         | 拒绝所有权限请求                                                    |
| safeStorage                 | [encryption.ts](../src/main/utils/encryption.ts)                                                                  | 密码加密使用 Electron `safeStorage`，禁用 localStorage 存储敏感数据 |
| 路径消毒                    | [abstract-protocol.ts](../src/main/services/protocol/abstract-protocol.ts) `sanitizePathOrError`                  | 调用 `sanitizePath` 拦截路径穿越，失败返回 `PATH_TRAVERSAL`         |
| 主机密钥验证                | [known-hosts.ts](../src/main/stores/known-hosts.ts) + SftpProtocol `hostVerifier`                                 | 首次连接 / hash 不匹配时弹窗确认，附 SHA256 校验和防篡改            |

## 错误处理

Rivet 不使用 try-catch 在业务层传播错误，而是通过 [src/shared/types/result.ts](../src/shared/types/result.ts) 的 `Result<T, E>` 联合类型与 [src/shared/types/protocol-request.ts](../src/shared/types/protocol-request.ts) 的 `ProtocolResponse<T>` 透传。

- `Result<T, E = Error>` 是 `Ok<T>` (`{ success: true, value, error: null }`) 与 `Err<E>` (`{ success: false, value: null, error }`) 的联合。配套函数 `ok` / `err` / `isOk` / `isErr`。
- `ErrorInfo` 字段：`code: string`、`message: string`、可选 `detail?: string`、可选 `stack?: string`。`createErrorInfo(code, message, detail?, stack?)` 工厂函数省略 undefined 字段。
- `ProtocolResponse<T>` 在 `Result` 基础上附加 `requestId`，用于关联请求与取消；`OperationResult` 为 `connect` 返回载荷。两者的字段结构与 `StatusCode` 数值见 [IPC 参考](./ipc-reference.md#protocol协议操作)。

错误码集中在 [src/shared/constants/error-code.ts](../src/shared/constants/error-code.ts)，按域分组：

- 连接：`CONN_FAILED`、`CONN_NOT_FOUND`、`AUTH_ERROR`、`SESSION_NOT_FOUND`、`SESSION_CLOSING`、`DISCONNECT_ERROR`、`CLEANUP_ERROR`。
- 列表：`LIST_ERROR` / `LIST_TIMEOUT` / `LIST_ABORTED` / `LIST_FAILED`。
- 目录：`MKDIR_ERROR` / `MKDIR_TIMEOUT` / `MKDIR_ABORTED`。
- 重命名：`RENAME_ERROR` / `RENAME_TIMEOUT` / `RENAME_ABORTED`。
- 删除：`DELETE_ERROR` / `DELETE_TIMEOUT` / `DELETE_ABORTED`。
- 复制 / 移动：`COPY_ERROR` / `COPY_ABORTED` / `MOVE_ERROR` / `MOVE_ABORTED`。
- 传输：`UPLOAD_IN_PROGRESS` / `UPLOAD_ERROR` / `UPLOAD_ABORTED` / `DOWNLOAD_ERROR` / `DOWNLOAD_ABORTED`。
- 加密：`ENCRYPT_UNAVAILABLE` / `ENCRYPTION_ERROR` / `DECRYPT_FORMAT_ERROR` / `DECRYPT_UNAVAILABLE` / `HMAC_MISMATCH` / `DECRYPTION_ERROR`。
- 其他：`REQUEST_ABORTED`、`PING_ERROR`、`PATH_TRAVERSAL`、`PATH_ERROR`、`HOST_KEY_ERROR`、`CONFIG_ERROR`、`INVALID_CONFIG`、`DIALOG_ERROR`、`INVALID_STATE`、`SELF_CONTAINED`。

`ERROR_MESSAGE` 提供 abort 类错误的统一英文文案。状态码定义见 [protocol-status.ts](../src/shared/constants/protocol-status.ts)，数值说明见 [IPC 参考](./ipc-reference.md#protocol协议操作)。

## 配置持久化

[src/main/stores/config/](../src/main/stores/config) 采用 electron-store + 内存缓存的双层模式：运行期所有读写走内存（`inMemoryConfig`），通过 `configChanged` 脏标记追踪变更，`startAutoSave` 按 `TIMEOUTS.AUTO_SAVE_INTERVAL`（5 分钟）定时刷盘。`flushConfigToDisk` 仅在脏标记为真时写盘，并对 `savePassword === false` 的连接剥离 `password` 字段；`initializeConfig` 启动时经 [validation.ts](../src/main/stores/config/validation.ts) 校验并过滤无效数据。[types.ts](../src/main/stores/config/types.ts) 定义 `StoreSchema`（`savedConnections` / `uiSettings` / `transferSettings` / `connectionSortOrder`）。内存访问与持久化函数的完整签名见 [Store 参考](./store-reference.md#electron-storeconfig)。

主机密钥独立存储在 [src/main/stores/known-hosts.ts](../src/main/stores/known-hosts.ts)：使用单独的 `Store`（文件名 `known-hosts.json`）与主配置隔离，每条记录附加 `checksum = sha256(connectionId + hash + createdAt)` 防篡改。方法清单见 [Store 参考](./store-reference.md#known-hosts)。

## 加密方案

[src/main/utils/encryption.ts](../src/main/utils/encryption.ts) 实现密码加密：

- `encryptPassword(password)` 调用 `safeStorage.encryptString(password).toString('base64')`，然后用 `getHmacKey()` 派生 HMAC-SHA256 密钥计算 `computeHmac(encrypted, hmacKey)`，最终格式 `safe:` + HMAC（hex，64 字符）+ encrypted（base64）。
- `decryptPassword(encrypted)` 反向解析：校验 `SAFE_PREFIX` 前缀、`safeStorage.isEncryptionAvailable()`、HMAC 一致性（不一致返回 `HMAC_MISMATCH`），最后 `safeStorage.decryptString(Buffer.from(actualData, 'base64'))`。
- HMAC 密钥来源：优先环境变量 `RIVET_HMAC_KEY`（hex 编码，64 字符 = 32 字节）；未设置时使用固定种子 `'Rivet-HMAC-Key-Derivation-Seed-v1'` 的 SHA256 派生。注释说明不能用 `safeStorage.encryptString` 派生密钥（每次返回不同结果，因内部使用随机 IV）。

## 日志

[src/main/utils/logger.ts](../src/main/utils/logger.ts) 基于 `electron-log/main`：

- `log.initialize()` 自动注入 preload，使渲染进程的 `electron-log` 调用转发到主进程。
- `log.transports.file.resolvePathFn` 设置日志文件路径为 `path.join(app.getPath('userData'), 'logs', 'main.log')`。
- `log.transports.file.level = 'info'`、`log.transports.console.level = 'info'`。
- 导出 `logger` 对象，方法 `info` / `warn` / `error` / `debug` 自动附加调用方信息（`getCallerInfo(CALLER_DEPTH.DIRECT_MAIN)`），非打包环境附加文件名行号；`logger.catch(error, context?)` 调用 `sharedCatchLog` 输出错误堆栈与上下文。

主进程错误处理约定（见工作区规则）：主进程错误用 `logger.catch` / `logger.error` 写文件，禁止 `console.error`；渲染进程错误通过 IPC 上报主进程。`uncaughtException` 触发 `cleanupAndExit` 退出码 1，`unhandledRejection` 仅记录不退出。
