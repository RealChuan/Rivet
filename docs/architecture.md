# 架构设计文档

## 技术栈

| 技术         | 版本 | 用途             |
| ------------ | ---- | ---------------- |
| Electron     | ^42  | 桌面应用框架     |
| React        | ^19  | 渲染进程 UI 框架 |
| TypeScript   | ^6   | 类型安全         |
| Zustand      | ^5   | 状态管理         |
| Tailwind CSS | ^4   | 样式系统         |
| i18next      | ^26  | 国际化           |

## 整体架构

Rivet 采用 Electron 的多进程架构，分为三层进程 + 一个共享层：

```
┌──────────────────────────────────────────────────────────────────┐
│                       渲染进程 (React 19)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   session    │  │file-explorer │  │   transfer   │           │
│  │   Feature    │  │   Feature    │  │   Feature    │           │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │           │
│  │  │comps   │  │  │  │comps   │  │  │  │comps   │  │           │
│  │  │hooks   │  │  │  │hooks   │  │  │  │hooks   │  │           │
│  │  │stores  │  │  │  │stores  │  │  │  │stores  │  │           │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────────────────────────┐         │
│  │  host-key    │  │  layout / pages / components     │         │
│  │  Feature     │  │  (ActivityBar, MainLayout, ...)  │         │
│  └──────────────┘  └──────────────────────────────────┘         │
│                                                                  │
│  ┌──────────┐  ┌────────────────────────────────────────┐       │
│  │ useUiStore│  │  stores / hooks / i18n / styles / utils│       │
│  └──────────┘  └────────────────────────────────────────┘       │
│                         │                                        │
│                    window.electronAPI                            │
└─────────────────────────┬────────────────────────────────────────┘
                          │ contextBridge
┌─────────────────────────▼────────────────────────────────────────┐
│                       Preload 层                                 │
│                                                                  │
│  contextBridge.exposeInMainWorld('electronAPI', {                │
│    protocol / transfer / config / dialog / hostKey               │
│    system / crypto / window                                      │
│  })                                                              │
│  + listenerManager (统一监听器管理, beforeunload 自动清理)        │
│  + system.generateUuid (crypto.randomUUID, 不经过 IPC)           │
│  + window.getMeta (读取 location.hash, 不经过 IPC)               │
└─────────────────────────┬────────────────────────────────────────┘
                          │ ipcMain.handle / ipcMain.on
┌─────────────────────────▼────────────────────────────────────────┐
│                    主进程 (Electron 42)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    IPC Handlers (透传层)                    │  │
│  │  protocol / transfer / config / dialog / hostKey           │  │
│  │  system / crypto / window                                  │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │ 委托                               │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │                     Service 层                             │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐     │  │
│  │  │  ProtocolService    │  │   TransferService       │     │  │
│  │  │  ├ SftpProtocol     │  │  (并发调度/进度/速度)    │     │  │
│  │  │  └ WebdavProtocol   │  │  ├ download-executor    │     │  │
│  │  │  └ (懒加载实例)     │  │  └ upload-executor      │     │  │
│  │  └─────────────────────┘  └─────────────────────────┘     │  │
│  │  ┌────────────────────┐  ┌──────────────────────────┐     │  │
│  │  │  SessionManager    │  │  SessionRegistry         │     │  │
│  │  │  (心跳/安全断连)    │  │  (Map<sessionId, Handle>)│     │  │
│  │  └────────────────────┘  └──────────────────────────┘     │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Stores / Utils                            │  │
│  │  config/ (electron-store + 内存缓存 + 定时刷盘)            │  │
│  │  known-hosts.ts (独立 electron-store, checksum 校验)       │  │
│  │  encryption.ts (safeStorage + HMAC)                        │  │
│  │  logger.ts / dialog.ts / system.ts / ...                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            WindowManager + Lifecycle                        │  │
│  │  无边框窗口工厂 / 关闭拦截 / 信号处理 / CSP / 权限拒绝     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                  Shared 层 (src/shared/)                         │
│                                                                  │
│  constants/                                                      │
│    ipc/        — IPC 通道名 (9 个模块文件 + events.ts + index.ts) │
│    app.ts      — APP_NAME, STORE_KEY, 窗口尺寸                  │
│    error-code.ts — ERROR_CODE (~50 个错误码)                     │
│    protocol.ts — PROTOCOL, SCHEME, FILE_OPERATION, LOG_ACTION    │
│    protocol-status.ts — ProtocolStatus, SftpStatus, StatusCode   │
│    timeouts.ts — TIMEOUTS 超时常量                                │
│    sort.ts     — SORT_ORDER, SORT_FIELD                          │
│    transfer.ts — OPERATION_STATUS, TRANSFER_DIRECTION,           │
│                  SIDEBAR_VIEW, TRANSFER_CONFIG, LAST_DIR_KEY     │
│    ui.ts       — THEME, TOAST_TYPE, FILE_TYPE, HOST_KEY_DIALOG_TYPE│
│    i18n.ts     — SUPPORTED_LANGUAGE, DEFAULT_LANGUAGE            │
│                                                                  │
│  types/                                                          │
│    result.ts / protocol-request.ts / operation-result.ts         │
│    connection.ts / file.ts / session.ts / settings.ts            │
│    transfer.ts / host-key.ts / host-key-dialog.ts / electron-api.ts│
│                                                                  │
│  utils/                                                          │
│    error.ts / format.ts / path.ts / i18n.ts                      │
│    generate-unique-filename.ts / logger-formatter.ts             │
│                                                                  │
│  test-utils/                                                     │
│    mocks/ — electron, electron-log, electron-store 的 mock       │
└──────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/
├── main/                        # Electron 主进程
│   ├── app/                     # 应用入口与生命周期
│   │   ├── main.ts              # 主进程入口
│   │   ├── lifecycle.ts         # 生命周期管理
│   │   └── window-factory.ts    # 窗口工厂 + WindowManager
│   ├── ipc/                     # IPC Handler（透传层）
│   │   ├── index.ts             # setupIpcHandlers() 注册入口
│   │   ├── protocol.ts          # 协议操作
│   │   ├── transfer.ts          # 传输任务
│   │   ├── config.ts            # 配置读写（仅 GET/SET）
│   │   ├── dialog.ts            # 原生对话框
│   │   ├── host-key.ts          # 主机密钥
│   │   ├── system.ts            # 系统路径
│   │   ├── crypto.ts            # 密码加密
│   │   └── window.ts            # 窗口控制
│   ├── services/                # 业务服务层
│   │   ├── protocol/            # 协议服务
│   │   │   ├── abstract-protocol.ts   # AbstractProtocol<T> 抽象基类
│   │   │   ├── SftpProtocol.ts        # SFTP 协议实现
│   │   │   ├── WebdavProtocol.ts      # WebDAV 协议实现
│   │   │   ├── protocol-service.ts    # ProtocolService 门面
│   │   │   ├── protocol-types.ts      # FileProtocol 接口、SessionInfo、HostVerifier 类型
│   │   │   └── index.ts              # 模块导出
│   │   ├── transfer/            # 传输服务
│   │   │   ├── transfer-service.ts    # TransferService 传输引擎
│   │   │   ├── transfer-context.ts    # TransferContext 接口 + TEMP_FILE_SUFFIX
│   │   │   ├── transfer-progress.ts   # 速度采样、进度节流
│   │   │   ├── transfer-cancellation.ts # 取消/重试逻辑
│   │   │   ├── transfer-scheduler.ts  # 任务调度逻辑
│   │   │   ├── download-executor.ts   # 下载执行器
│   │   │   ├── upload-executor.ts     # 上传执行器
│   │   │   └── index.ts              # 模块导出
│   │   ├── session-manager.ts         # SessionManager 心跳/断连
│   │   └── session-registry.ts        # SessionRegistry 会话注册表
│   ├── stores/                  # 主进程 Store
│   │   ├── config/              # 配置持久化
│   │   │   ├── store.ts         # electron-store 实例 + 内存缓存
│   │   │   ├── persistence.ts   # 初始化/刷盘/自动保存
│   │   │   ├── types.ts         # StoreSchema 接口
│   │   │   ├── ui-settings.ts   # defaultUiSettings
│   │   │   └── validation.ts    # 校验函数
│   │   └── known-hosts.ts       # SSH 主机密钥存储
│   └── utils/                   # 工具函数
│       ├── logger.ts            # electron-log 封装
│       ├── encryption.ts        # safeStorage + HMAC 加密
│       ├── dialog.ts            # 原生对话框
│       ├── system.ts            # 系统路径
│       ├── generate-session-id.ts  # 会话 ID 生成
│       └── window-meta.ts       # 窗口元数据
├── preload/                     # Preload 层
│   ├── index.ts                 # contextBridge.exposeInMainWorld
│   ├── listener-manager.ts      # 监听器统一管理
│   ├── protocol.ts              # protocolAPI
│   ├── transfer.ts              # transferAPI
│   ├── config.ts                # configAPI
│   ├── dialog.ts                # dialogAPI
│   ├── host-key.ts              # hostKeyAPI
│   ├── system.ts                # systemAPI
│   ├── crypto.ts                # cryptoAPI
│   └── window.ts                # windowAPI
├── renderer/                    # 渲染进程
│   ├── App.tsx                  # 应用根组件
│   ├── index.tsx                # React 挂载入口
│   ├── sentry.ts                # Sentry 初始化
│   ├── components/              # 通用组件
│   │   ├── common/              # 业务组件 (TitleBar, Toast, ErrorBoundary 等)
│   │   └── ui/                  # 基础 UI 组件 (Button, Input, Select 等)
│   ├── features/                # 功能模块
│   │   ├── session/             # 会话/连接管理
│   │   ├── file-explorer/       # 文件浏览器
│   │   ├── transfer/            # 文件传输
│   │   └── host-key/            # 主机密钥验证
│   ├── hooks/                   # 全局 Hooks
│   ├── i18n/                    # 国际化
│   ├── layout/                  # 布局组件 (ActivityBar, MainLayout)
│   ├── pages/                   # 页面组件 (ConnectionPage, TransferPage)
│   ├── stores/                  # 全局 Store (ui.ts)
│   ├── styles/                  # 全局样式
│   └── utils/                   # 工具函数 (cn.ts, logger.ts, sort-utils.ts)
└── shared/                      # 共享层
    ├── constants/               # 常量
    │   ├── ipc/                 # IPC 通道名 (9 个模块文件 + events.ts + index.ts)
    │   ├── app.ts               # APP_NAME, STORE_KEY, 窗口尺寸等
    │   ├── error-code.ts        # ERROR_CODE 约 50 个错误码
    │   ├── protocol.ts          # PROTOCOL, SCHEME, FILE_OPERATION, LOG_ACTION
    │   ├── protocol-status.ts   # ProtocolStatus, SftpStatus, StatusCode
    │   ├── timeouts.ts          # TIMEOUTS 超时常量
    │   ├── sort.ts              # SORT_ORDER, SORT_FIELD
    │   ├── transfer.ts          # OPERATION_STATUS, TRANSFER_DIRECTION, SIDEBAR_VIEW, TRANSFER_CONFIG, LAST_DIR_KEY
    │   ├── ui.ts                # THEME, TOAST_TYPE, FILE_TYPE, HOST_KEY_DIALOG_TYPE
    │   └── i18n.ts              # SUPPORTED_LANGUAGE, DEFAULT_LANGUAGE
    ├── types/                   # 类型定义
    │   ├── result.ts            # Result<T,E>, Ok, Err, ErrorInfo
    │   ├── protocol-request.ts  # ProtocolResponse<T>, RequestId
    │   ├── operation-result.ts  # OperationResult, SftpConnectDetail
    │   ├── connection.ts        # ConnectionConfig
    │   ├── file.ts              # FileInfo
    │   ├── session.ts           # Session
    │   ├── settings.ts          # UiSettings, TransferSettings
    │   ├── transfer.ts          # TransferTask, UploadOperation, TransferProgressData, ConflictItem, DeduplicateResult, LocalFileInfo
    │   ├── host-key.ts          # HostKey
    │   ├── host-key-dialog.ts   # HostKeyVerificationDialogState
    │   └── electron-api.ts      # ElectronAPI 及各命名空间接口
    ├── utils/                   # 工具函数
    │   ├── error.ts             # formatErrorMessage
    │   ├── format.ts            # formatFileSize, formatDate
    │   ├── path.ts              # normalizePath, sanitizePath, joinPaths, getParentPath, pathBasename, isSubPath
    │   ├── i18n.ts              # detectLanguageWithFallback
    │   ├── generate-unique-filename.ts  # generateUniqueFilename
    │   └── logger-formatter.ts  # getCallerInfo, formatMessage, catchLog
    └── test-utils/              # 测试工具
        └── mocks/               # electron, electron-log, electron-store 的 mock
```

## 进程职责

### 主进程

主进程负责所有需要 Node.js 能力的操作：

- **窗口管理**：无边框窗口创建、状态管理、子窗口支持
- **协议连接**：SFTP（ssh2-sftp-client）和 WebDAV（webdav）的连接/断连/心跳
- **文件操作**：list / mkdir / rename / delete / copy / move
- **文件传输**：上传/下载的并发调度、进度计算、速度采样
- **配置持久化**：electron-store 管理连接配置、UI 设置和传输设置
- **安全**：safeStorage 密码加密、known_hosts 管理、CSP 策略

入口文件：`src/main/app/main.ts`

#### 启动流程

1. **Sentry.init()** — 仅生产环境 + 配置了 DSN 时启用
2. **app.enableSandbox()** — 全局启用沙箱
3. **app.whenReady().then(...)**:
   - `session.defaultSession.setPermissionRequestHandler()` — 拒绝所有权限请求
   - CSP 配置 — 通过 `onHeadersReceived` 设置 HTTP 头，开发环境放宽（`unsafe-inline`/`unsafe-eval`/`ws://localhost:*`），生产环境严格
   - `initializeConfig()` — 加载配置到内存
   - `startAutoSave()` — 启动定时自动保存
   - `setupIpcHandlers()` — 注册所有 IPC 处理器
   - `createMainWindow()` — 创建主窗口
4. **setupAppLifecycle()** — 注册窗口关闭、退出前清理、信号处理等

### Preload 层

Preload 是渲染进程与主进程之间的安全桥梁：

- 通过 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露 8 个命名空间 API
- 每个 IPC 调用包装为独立命名函数，**不暴露原始 `ipcRenderer`**
- `listener-manager.ts` 统一管理 `ipcRenderer.on` 监听器，`beforeunload` 时自动清理
- `system.generateUuid` 直接调用 `crypto.randomUUID()`，不经过 IPC
- `window.getMeta` 直接读取 `window.location.hash`，不经过 IPC（`window.refreshMeta` 通过 IPC 刷新）

入口文件：`src/preload/index.ts`

### 渲染进程

渲染进程是纯 UI 层，不直接访问 Node.js API：

- **页面导航**：状态驱动，通过 `useUiStore.activeView` 切换 ConnectionPage / TransferPage
- **功能模块**：每个功能（session / file-explorer / transfer / host-key）独立目录，包含 components / hooks / stores
- **状态管理**：Zustand Store，组件内通过 selector 订阅
- **UI 组件**：通用组件（`components/common/`）+ 基础 UI 组件（`components/ui/`）

入口文件：`src/renderer/index.tsx`

## IPC 通信模式

### 三层透传

```
渲染进程 (window.electronAPI.xxx)
    ↓ ipcRenderer.invoke / ipcRenderer.send / ipcRenderer.on
Preload 层 (contextBridge.exposeInMainWorld)
    ↓ ipcRenderer.invoke / ipcRenderer.on
主进程 IPC Handler (ipcMain.handle / ipcMain.on)
    ↓ 委托
主进程 Service 层 (protocolService / transferService / ...)
```

**核心原则**：IPC Handler 只做透传，不包含业务逻辑。错误处理由 Service 层负责，IPC 层不添加 try-catch。

### 通信方向

| 方向          | 方式                                      | 示例                                        |
| ------------- | ----------------------------------------- | ------------------------------------------- |
| 渲染 → 主进程 | `ipcRenderer.invoke` → `ipcMain.handle`   | `protocol.connect`, `transfer.add`          |
| 主进程 → 渲染 | `win.webContents.send` → `ipcRenderer.on` | `transfer:progress`, `session-disconnected` |
| 单向通知      | `ipcRenderer.send` → `ipcMain.on`         | `window:minimize`, `window:close`           |

### IPC 通道命名

所有通道名定义在 `src/shared/constants/ipc/` 下，按模块拆分为 9 个文件，格式为 `模块:操作`：

```
protocol:connect    transfer:add        config:get
protocol:list       transfer:progress   dialog:show-open-dialog
window:minimize     crypto:encrypt-password
```

### Preload API 命名空间

| 命名空间    | 文件          | 主要方法                                                                                                                                                                                                                |
| ----------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| protocolAPI | `protocol.ts` | connect, disconnect, list, mkdir, rename, delete, copy, move, cancel, onSessionDisconnected                                                                                                                             |
| transferAPI | `transfer.ts` | add, cancel, cancelAll, retry, retryAll, getTasks, getConcurrency, setConcurrency, checkLocalFiles, getLastDir, setLastDir, onTasksEnqueued, onProgress, onTaskCompleted, onTaskFailed, onTaskRemoved, onHasActiveTasks |
| configAPI   | `config.ts`   | get, set                                                                                                                                                                                                                |
| dialogAPI   | `dialog.ts`   | showOpenDialog, showSaveDialog, getPathForFile                                                                                                                                                                          |
| hostKeyAPI  | `host-key.ts` | save, delete                                                                                                                                                                                                            |
| systemAPI   | `system.ts`   | getTempDir, getDownloadDir, generateUuid (crypto.randomUUID, 不经过 IPC)                                                                                                                                                |
| cryptoAPI   | `crypto.ts`   | encryptPassword, decryptPassword                                                                                                                                                                                        |
| windowAPI   | `window.ts`   | minimize, maximize, close, quit, getState, onStateChange, createChild, closeChild, getMeta (读取 location.hash, 不经过 IPC), refreshMeta                                                                                |

## 协议抽象层

### 类层次

```
FileProtocol (接口, 定义在 protocol-types.ts)
  └── AbstractProtocol<T> (抽象基类, 定义在 abstract-protocol.ts)
        ├── SftpProtocol extends AbstractProtocol<Client>          (ssh2-sftp-client)
        └── WebdavProtocol extends AbstractProtocol<WebDAVSession> (webdav)
```

### 模板方法模式

`AbstractProtocol` 提供统一的公共方法（`list` / `mkdir` / `rename` / `delete` / `copy` / `move` / `upload` / `download` / `ping`），每个方法负责：

1. **客户端获取**：`getClient(sessionId)` 从 SessionRegistry 获取协议客户端
2. **路径消毒**：`sanitizePath(path)` 防止路径遍历攻击
3. **超时与取消**：`withAbort(signal, operation, timeout, ...)` 统一超时和取消机制
4. **日志记录**：操作成功/失败均记录日志
5. **委托实现**：调用子类的 `*Impl` 方法

子类只需实现 `*Impl` 方法，无需关心路径安全、超时、日志等横切关注点。

### ProtocolService 门面

`ProtocolService` 是协议层的门面，管理协议实例和请求生命周期：

- 按协议类型懒加载创建 `SftpProtocol` / `WebdavProtocol` 实例
- `connect()` / `disconnect()` / `list()` / `mkdir()` / `rename()` / `delete()` / `copy()` / `move()` 返回 `ProtocolResponse<T>`
- `upload()` / `download()` / `ping()` 返回 `Result<T, ErrorInfo>`（由 TransferService 直接调用，不需要 requestId 包装）
- `connect()` 时解密密码、构建 `hostVerifier`、注册会话
- `disconnect()` 时检查是否有活跃传输任务

## 传输引擎

### TransferService

`TransferService` 是主进程的传输引擎，核心职责：

- **并发调度**：`maxConcurrency` 控制同时运行的任务数（默认 5，最小 1，最大 10），上传和下载分别独立控制
- **文件夹递归展开**：文件夹上传时先 `mkdir`，再递归扫描子项，动态创建子操作
- **进度计算**：每个任务和操作独立追踪 `transferredSize`
- **速度采样**：滑动窗口（3 秒）计算实时传输速度
- **进度节流**：主进程侧 `PROGRESS_THROTTLE_MS`（500ms）节流，渲染进程侧 250ms 批量合并
- **下载临时文件策略**：先写入 `.rivet-download` 后缀的临时文件（`TEMP_FILE_SUFFIX`），完成后再 rename

### 传输状态机

```
WAITING → RUNNING → COMPLETED → (removed)
                   → FAILED → (retry) → WAITING
                   → (cancel) → (removed)
```

### 渲染进程传输同步

渲染进程通过 `useTransferStore.startListening()` 订阅主进程事件：

| 事件                      | 说明             |
| ------------------------- | ---------------- |
| `transfer:tasks-enqueued` | 新任务入队       |
| `transfer:progress`       | 传输进度更新     |
| `transfer:task-completed` | 任务完成         |
| `transfer:task-failed`    | 任务失败         |
| `transfer:task-removed`   | 任务移除（取消） |

进度更新采用批量合并策略：250ms 内的多次 `progress` 事件合并为一次状态更新，避免频繁重渲染。

## 会话管理

### SessionRegistry

[SessionRegistry](../src/main/services/session-registry.ts) 是会话注册表，维护 `Map<sessionId, SessionHandle>`。`SessionHandle` 接口定义见同文件。

### SessionManager

`SessionManager` 负责会话的生命周期管理：

- **心跳检测**：`HEARTBEAT_INTERVAL`（30s）定时 `ping` 所有活跃会话，失败则自动断连
- **安全断连**：`safeUnregister()` 检查活跃传输 → 设置 `isClosing` → 调用协议断连 → 超时保护
- **批量清理**：`safeUnregisterAll()` 用于应用退出时清理所有会话

> **注意**：`SftpProtocol.connect` 和 `WebdavProtocol.connect` 直接调用 `sessionRegistry.register()`，而非 `sessionManager.register()`。

### 连接流程

```
1. 渲染进程调用 window.electronAPI.protocol.connect(config)
2. Preload 透传到主进程 IPC
3. ProtocolService.connect() 解密密码 → 获取协议实例 → 调用 protocol.connect()
4. SFTP: 创建 Client、连接、hostVerifier 校验 → 注册到 SessionRegistry
5. WebDAV: 创建 WebDAVClient、验证 basePath → 注册到 SessionRegistry
6. 返回 ProtocolResponse<OperationResult> (含 sessionId + statusCode + detail)
```

### 主机密钥验证流程

```
首次连接 → 返回 FIRST_CONNECT (ProtocolStatus.FIRST_CONNECT = 2001) → 渲染进程弹窗让用户确认
密钥不匹配 → 返回 HOST_KEY_MISMATCH (SftpStatus.HOST_KEY_MISMATCH = 3000) → 渲染进程弹窗警告
用户确认后 → 调用 hostKey.save 保存 → 重新连接
```

## 状态驱动导航

项目不使用 react-router 进行主窗口导航，而是采用状态驱动模式：

```typescript
useUiStore.activeView: SidebarView
  ├── SIDEBAR_VIEW.CONNECTIONS  → ConnectionPage
  └── SIDEBAR_VIEW.TRANSFERS    → TransferPage
```

`ActivityBar` 切换 `activeView`，`MainLayout` 中的 `PageContent` 根据 `activeView` 显示/隐藏对应页面（CSS `display` 切换，非卸载）。

子窗口支持：通过 `WindowManager.create()` 创建带路由的子窗口，路由通过 URL hash 传递。

## 安全基线

| 安全措施                      | 说明                                               |
| ----------------------------- | -------------------------------------------------- |
| `contextIsolation: true`      | 渲染进程与 Preload 上下文隔离                      |
| `nodeIntegration: false`      | 渲染进程禁止直接使用 Node.js                       |
| `sandbox: true`               | 全局启用沙箱（`app.enableSandbox()`）              |
| CSP                           | 生产环境禁止 `unsafe-inline` 脚本和 `unsafe-eval`  |
| `will-navigate` 拦截          | 阻止非预期导航                                     |
| `setWindowOpenHandler`        | 阻止新窗口打开                                     |
| `setPermissionRequestHandler` | 拒绝所有权限请求                                   |
| safeStorage                   | 密码加密存储（+ HMAC 校验），禁止写入 localStorage |
| 路径消毒                      | `sanitizePath()` 防止路径遍历攻击                  |

## 错误处理

### Result 类型

主进程 Service 层使用 [Result](../src/shared/types/result.ts)`<T, ErrorInfo>` 类型返回结果：成功时 `{ success: true, value: T, error: null }`，失败时 `{ success: false, value: null, error: ErrorInfo }`。完整定义见源文件。

### ProtocolResponse

IPC 层使用 [ProtocolResponse](../src/shared/types/protocol-request.ts)`<T>` 包装，额外包含 `requestId`，为 `ProtocolSuccessResponse<T> | ProtocolErrorResponse` 联合类型。完整定义见源文件。

### ErrorInfo

[ErrorInfo](../src/shared/types/result.ts) 包含 `code`、`message`、可选的 `detail` 和 `stack` 字段。

### 错误码

所有错误码定义在 [error-code.ts](../src/shared/constants/error-code.ts)，约 50 个错误码，如 `SESSION_NOT_FOUND`、`PATH_TRAVERSAL`、`UPLOAD_ABORTED` 等。

## 配置持久化

### 存储架构

使用 electron-store + 内存缓存模式：

- **[StoreSchema](../src/main/stores/config/types.ts)**：`{ savedConnections, uiSettings, transferSettings }`
- **内存优先策略**：修改先写入内存，定时（`AUTO_SAVE_INTERVAL` = 300000ms）刷盘
- **密码剥离**：[flushConfigToDisk](../src/main/stores/config/persistence.ts) 时，`savePassword=false` 的连接密码被剥离
- **known-hosts**：使用独立的 electron-store 实例（`name: 'known-hosts'`），带 checksum 校验

### 相关文件

| 文件                                                       | 职责                           |
| ---------------------------------------------------------- | ------------------------------ |
| [store.ts](../src/main/stores/config/store.ts)             | electron-store 实例 + 内存缓存 |
| [persistence.ts](../src/main/stores/config/persistence.ts) | 初始化/刷盘/自动保存           |
| [types.ts](../src/main/stores/config/types.ts)             | StoreSchema 接口               |
| [ui-settings.ts](../src/main/stores/config/ui-settings.ts) | defaultUiSettings              |
| [validation.ts](../src/main/stores/config/validation.ts)   | 校验函数                       |
| [known-hosts.ts](../src/main/stores/known-hosts.ts)        | SSH 主机密钥存储               |

## 加密方案

使用 Electron `safeStorage.encryptString()` + HMAC 校验：

- **格式**：`safe:` + HMAC（64 字符 hex）+ Base64 加密数据
- **HMAC 密钥来源**：优先环境变量 `RIVET_HMAC_KEY`（64 字符 hex），否则使用固定种子派生
- **校验流程**：解密时先验证 HMAC，确保数据未被篡改

## 日志

- **主进程**：使用 `electron-log/main` 封装的 logger
- **日志文件路径**：`app.getPath('userData')/logs/main.log`
- **文件和控制台级别**：均为 `info`
- **开发环境**：附加调用者信息
- **渲染进程**：日志通过 logger 转发到主进程统一记录
