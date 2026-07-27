# Store 状态参考手册

## 概述

本项目使用 Zustand 5 管理前端状态，所有 Store 都以 `use[Feature]Store` hook 形式导出，从不导出裸 store 实例。组件消费时必须使用 selector 形式 `useStore(state => state.xxx)`，避免订阅整个 state 触发不必要的重渲染；需要同时订阅多个字段时使用 `useShallow`（来自 `zustand/react/shallow`），例如 `useStore(useShallow(s => ({ a: s.a, b: s.b })))`，禁止直接对 `useStore()` 进行解构。主进程使用 `electron-store` 维护配置与已知主机密钥，并通过模块级函数暴露读写接口。

## 渲染进程 Store

### useUiStore

文件：[ui.ts](../src/renderer/stores/ui.ts)

职责：维护全局 UI 偏好（主题、语言、面板宽度、活跃侧栏视图）以及 Toast 队列。

State

| 字段                 | 类型                           | 默认值                                    | 说明                                      |
| -------------------- | ------------------------------ | ----------------------------------------- | ----------------------------------------- |
| appearance           | Theme                          | DEFAULT_THEME_VALUE（'system'）           | 主题，可选 'light' / 'dark' / 'system'    |
| locale               | SupportedLanguageLiteral \| '' | DEFAULT_LANGUAGE（'en-US'）               | 语言代码，空串表示跟随系统                |
| connectionPanelWidth | number                         | DEFAULT_CONNECTION_PANEL_WIDTH（260）     | 连接面板宽度（px）                        |
| transferPanelWidth   | number                         | DEFAULT_TRANSFER_PANEL_WIDTH（260）       | 传输面板宽度（px）                        |
| queueDrawerOpen      | boolean                        | false                                     | 队列抽屉是否展开                          |
| queueDrawerWidth     | number                         | DEFAULT_QUEUE_DRAWER_WIDTH（360）         | 队列抽屉宽度（px）                        |
| initialized          | boolean                        | false                                     | 是否已完成初始化                          |
| activeView           | SidebarView                    | SIDEBAR_VIEW.CONNECTIONS（'connections'） | 当前侧栏视图，'connections' / 'transfers' |
| toasts               | Toast[]                        | []                                        | 当前显示的 Toast 列表                     |

Actions

| 方法                    | 参数                             | 说明                                                                                                                |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| setAppearance           | appearance: Theme                | 设置主题；同时读取当前 locale，将 `{ appearance, locale }` 写入 `electronAPI.config.set(STORE_KEY.UI_SETTINGS)`     |
| setLocale               | locale: SupportedLanguageLiteral | 设置语言；同时读取当前 appearance，将 `{ appearance, locale }` 写入 `electronAPI.config.set(STORE_KEY.UI_SETTINGS)` |
| setConnectionPanelWidth | width: number                    | 设置连接面板宽度                                                                                                    |
| setTransferPanelWidth   | width: number                    | 设置传输面板宽度                                                                                                    |
| setActiveView           | view: SidebarView                | 切换侧栏视图                                                                                                        |
| initialize              | settings: Partial<UiSettings>    | 用持久化设置初始化 store，将 activeView 重置为 'connections'，initialized 置为 true                                 |
| addToast                | toast: Omit<Toast, 'id'>         | 添加一条 Toast；duration 为 0 时不自动消失，其余根据 type 自动计算超时（error 6s，其他 3s），到期自动移除           |
| removeToast             | id: string                       | 主动移除指定 Toast 并清理其计时器                                                                                   |

Toast 类型（[ui.ts](../src/renderer/stores/ui.ts)）字段：`id: string`（自动用 `crypto.randomUUID()` 生成）、`type: ToastType`（'success' / 'error' / 'info' / 'warning'）、`message: string`、`duration?: number`、`timer?: ReturnType<typeof setTimeout> | undefined`。

### useSessionStore

文件：[session.ts](../src/renderer/features/session/stores/session.ts)

职责：维护通过 `protocol.connect()` 建立的运行时会话列表，包含当前路径、文件列表、加载/操作状态等。

State

| 字段                 | 类型           | 默认值 | 说明                                          |
| -------------------- | -------------- | ------ | --------------------------------------------- |
| sessions             | Session[]      | []     | 活跃会话列表                                  |
| activeSessionId      | string \| null | null   | 当前激活会话的 sessionId                      |
| currentListRequestId | string \| null | null   | 最近一次目录列举请求的 UUID，用于丢弃过期响应 |

Actions

| 方法                    | 参数                                       | 说明                                                                                                                                            |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| setActiveSession        | sessionId: string                          | 设置 activeSessionId                                                                                                                            |
| updateSession           | sessionId: string, patch: Partial<Session> | 用 patch 浅合并指定会话                                                                                                                         |
| updateCurrentPath       | sessionId: string, path: string            | 等价于 updateSession(sessionId, { currentPath: path })                                                                                          |
| setFiles                | sessionId: string, files: FileInfo[]       | 经 sanitizeFiles 清洗后写入会话 files                                                                                                           |
| setLoading              | sessionId: string, loading: boolean        | 设置 isLoading                                                                                                                                  |
| setOperating            | sessionId: string, operating: boolean      | 设置 isOperating                                                                                                                                |
| refreshCurrentDirectory | sessionId: string                          | Promise<void>；生成新 requestId 写入 currentListRequestId，取消旧请求，调用 `electronAPI.protocol.list`，按 requestId 一致性写入 files 或 error |
| addSession              | session: Session                           | 追加会话并自动激活                                                                                                                              |
| replaceSession          | connectionId: string, session: Session     | 移除同 connectionId 的旧会话，追加新会话并激活                                                                                                  |
| removeSession           | sessionId: string                          | 移除会话；若被移除的是当前激活会话则 activeSessionId 重置为 null                                                                                |

Getters

| 方法                     | 参数                 | 返回                 |
| ------------------------ | -------------------- | -------------------- |
| getSessionByConnectionId | connectionId: string | Session \| undefined |
| getSessionById           | sessionId: string    | Session \| undefined |

Session 类型定义在 [session.ts](../src/shared/types/session.ts)，字段：`sessionId: string`、`connectionId: string`、`currentPath: string`、`files: FileInfo[]`、`isConnected: boolean`、`isLoading: boolean`、`isOperating: boolean`、`error: string | null`。

### useConnectionStore

文件：[connection.ts](../src/renderer/features/session/stores/connection.ts)

职责：管理已保存的连接配置列表、连接对话框状态以及列表排序方式。

State

| 字段                    | 类型                     | 默认值                    | 说明                                  |
| ----------------------- | ------------------------ | ------------------------- | ------------------------------------- |
| connections             | ConnectionConfig[]       | []                        | 已保存的连接配置                      |
| pendingConnectionConfig | ConnectionConfig \| null | null                      | 连接对话框中正在编辑的配置            |
| pendingIsEditing        | boolean                  | false                     | 是否处于编辑模式（区别于新建）        |
| closeConnectionDialog   | boolean                  | false                     | 用于触发对话框关闭的标志位            |
| sortOrder               | SortOrder                | SORT_ORDER.NONE（'none'） | 列表排序方式：'none' / 'asc' / 'desc' |

Actions

| 方法                       | 参数                                                 | 说明                                                                                                                                     |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| addConnection              | config: ConnectionConfig                             | 追加连接配置，返回 config.id                                                                                                             |
| updateConnection           | config: ConnectionConfig                             | 用 config.id 匹配并替换                                                                                                                  |
| deleteConnection           | connectionId: string                                 | Promise<void>；从内存移除并调用 `electronAPI.config.set(STORE_KEY.SAVED_CONNECTIONS, ...)` 与 `electronAPI.hostKey.delete(connectionId)` |
| loadSavedConnections       | 无                                                   | Promise<void>；从 `electronAPI.config.get(STORE_KEY.SAVED_CONNECTIONS)` 读取并校验后写入 state                                           |
| loadSortOrderFromSettings  | 无                                                   | Promise<void>；从配置读取 sortOrder                                                                                                      |
| saveConnectionConfigs      | 无                                                   | Promise<void>；将当前 connections 写回 `STORE_KEY.SAVED_CONNECTIONS`                                                                     |
| setPendingConnectionConfig | config: ConnectionConfig \| null, isEditing: boolean | 设置对话框编辑态                                                                                                                         |
| setCloseConnectionDialog   | close: boolean                                       | 设置关闭标志位                                                                                                                           |
| setSortOrder               | order: SortOrder                                     | Promise<void>；写入 state 并持久化                                                                                                       |
| reorderConnections         | activeId: string, overId: string                     | Promise<void>；基于 `@dnd-kit/sortable` 的 arrayMove 重排，并将 sortOrder 重置为 NONE                                                    |
| sortConnections            | order: SortOrderWithDirection                        | Promise<void>；按 name.localeCompare 排序（ASC 正序，DESC 反序），更新 state 并持久化                                                    |

Getters

| 方法              | 参数                 | 返回                          |
| ----------------- | -------------------- | ----------------------------- |
| getConnectionById | connectionId: string | ConnectionConfig \| undefined |

ConnectionConfig 类型定义在 [connection.ts](../src/shared/types/connection.ts)，字段：`id: string`、`name: string`、`protocol: ProtocolType`、`host: string`、`port: number`、`username: string`、`password?: string`、`savePassword?: boolean`、`basePath?: string`、`scheme?: SchemeType`、`rejectUnauthorized?: boolean`。

### 文件浏览器状态

文件浏览器模块不使用 Zustand Store，相关状态由自定义 hooks 管理。以下仅列出与"状态"相关的核心 hooks，全部位于 [hooks](../src/renderer/features/file-explorer/hooks/) 目录。

| Hook                   | 文件                                                                                                    | 职责                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| useFileSort            | [use-file-sort.ts](../src/renderer/features/file-explorer/hooks/use-file-sort.ts)                       | 维护文件列表的 sortBy / sortOrder 状态，提供 sortedFiles 派生值与 handleSort 切换函数；默认 sortBy='name'、sortOrder='asc'  |
| useFileListState       | [use-file-list-state.ts](../src/renderer/features/file-explorer/hooks/use-file-list-state.ts)           | 维护选中文件、删除/重命名/新建文件夹/属性对话框开关、悬停文件、右键菜单等 UI 状态                                           |
| useDirectoryNavigation | [use-directory-navigation.ts](../src/renderer/features/file-explorer/hooks/use-directory-navigation.ts) | 封装目录导航逻辑：handleNavigate、handleDoubleClick（双击目录进入）、handleParentDirectory（回到父目录，根路径 '/' 时跳过） |

### useTransferStore

文件：[transfer.ts](../src/renderer/features/transfer/stores/transfer.ts)

职责：维护传输任务队列、进度、并发配置以及面板可见性，监听主进程推送的任务事件并批量刷新进度。

State

| 字段                   | 类型                                 | 默认值                                   | 说明                                                  |
| ---------------------- | ------------------------------------ | ---------------------------------------- | ----------------------------------------------------- |
| tasks                  | TransferTask[]                       | []                                       | 当前传输任务列表                                      |
| taskProgress           | Map<string, TaskProgress>            | new Map()                                | 按 taskId 索引的进度数据，独立于 tasks 避免列表重渲染 |
| sessionTaskSummaries   | SessionTaskSummary[]                 | []                                       | 按 sessionId 聚合的任务摘要（派生）                   |
| sessionIds             | string[]                             | []                                       | 出现在 tasks 中的不重复 sessionId 列表（派生）        |
| runningTaskCount       | number                               | 0                                        | 处于 RUNNING 或 WAITING 状态的任务数（派生）          |
| selectedSessionId      | string \| null                       | null                                     | 当前在传输面板选中的会话                              |
| activeOperations       | Map<string, OperationProgressInfo[]> | new Map()                                | 按 taskId 索引的活跃子操作进度                        |
| isVisible              | boolean                              | true                                     | 传输面板是否可见；为 false 时仅缓冲进度不刷新         |
| activeTab              | TransferDirection                    | TRANSFER_DIRECTION.UPLOAD（'upload'）    | 当前选中的上传/下载标签                               |
| maxUploadConcurrency   | number                               | TRANSFER_CONFIG.DEFAULT_CONCURRENCY（5） | 上传并发上限                                          |
| maxDownloadConcurrency | number                               | TRANSFER_CONFIG.DEFAULT_CONCURRENCY（5） | 下载并发上限                                          |

Actions

| 方法                      | 参数                                                                  | 说明                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| setSelectedSessionId      | sessionId: string \| null                                             | 设置选中会话                                                                                                              |
| setVisible                | visible: boolean                                                      | 设置可见性；从隐藏切到可见时立即 flush 缓冲的进度批                                                                       |
| setActiveTab              | direction: TransferDirection                                          | 切换上传/下载标签                                                                                                         |
| setMaxUploadConcurrency   | value: number                                                         | 设置上传并发，并通过 `electronAPI.transfer.setConcurrency(value, UPLOAD)` 同步到主进程                                    |
| setMaxDownloadConcurrency | value: number                                                         | 设置下载并发，并通过 `electronAPI.transfer.setConcurrency(value, DOWNLOAD)` 同步到主进程                                  |
| handleTasksEnqueued       | tasks: TransferTask[]                                                 | 追加新任务，初始化每个任务的 taskProgress；若 selectedSessionId 为空则取首个任务 sessionId                                |
| handleProgress            | data: TransferProgressData                                            | 将 data 推入 progressBatch.buffer；若不可见直接返回；否则启动 250ms 定时器（TIMEOUTS.PROGRESS_FLUSH_MS）批量应用          |
| handleTaskCompleted       | data: { taskId: string; transferredSize?: number; fileSize?: number } | 先 flush 缓冲，再从 tasks/taskProgress/activeOperations 中移除该任务                                                      |
| handleTaskFailed          | data: { taskId: string; errorMessage: string }                        | 将任务状态置为 FAILED 并写入 errorMessage                                                                                 |
| handleTaskRemoved         | data: { taskId: string }                                              | 从 tasks/taskProgress/activeOperations 中移除该任务                                                                       |
| loadExistingTasks         | 无                                                                    | Promise<void>；从 `electronAPI.transfer.getTasks()` 拉取已存在任务并去重合并                                              |
| loadConcurrency           | 无                                                                    | Promise<void>；并行拉取上传/下载并发上限                                                                                  |
| startListening            | 无                                                                    | 订阅 transfer 模块的 onTasksEnqueued / onProgress / onTaskCompleted / onTaskFailed / onTaskRemoved 事件，返回取消订阅函数 |

Selectors

| 方法                             | 参数                                                                  | 返回           |
| -------------------------------- | --------------------------------------------------------------------- | -------------- |
| selectTasksForSessionByDirection | state: TransferState, sessionId: string, direction: TransferDirection | TransferTask[] |

TaskProgress 类型（[transfer.ts](../src/renderer/features/transfer/stores/transfer.ts)）：`transferredSize: number`、`speed?: number | undefined`、`fileSize?: number | undefined`、`totalFileCount?: number | undefined`、`completedFileCount?: number | undefined`、`activeFileCount?: number | undefined`、`waitingFileCount?: number | undefined`。

SessionTaskSummary 类型（[transfer.ts](../src/renderer/features/transfer/stores/transfer.ts)）：`sessionId: string`、`running: number`、`failed: number`、`total: number`。

OperationProgressInfo 类型（[transfer.ts](../src/shared/types/transfer.ts)）：`id: string`、`itemName: string`、`type: TransferOperationType`、`transferredSize: number`、`fileSize?: number`、`status: OperationStatus`、`startedAt?: number`、`speed?: number`。

进度批合并机制在 [transfer-progress-batch.ts](../src/renderer/features/transfer/stores/transfer-progress-batch.ts) 中实现。`createProgressBatchState()` 返回 `{ buffer: TransferProgressData[], timerId: ReturnType<typeof setTimeout> | null }`，是模块级单例。`handleProgress` 把数据 push 到 buffer，当 `isVisible === false` 时直接返回不调度刷新；否则用 `setTimeout` 启动 250ms（`TIMEOUTS.PROGRESS_FLUSH_MS`）定时器，到期后调用 `applyBatchToState(batch)` 一次性合并。`applyProgressBatch` 逐条比较 transferredSize/speed/fileSize/各种 fileCount/activeOperations，仅在发生变化时才构造新的 Map（避免无变更时返回新引用），并在 task 当前为 WAITING 时同步切换为 RUNNING。`setVisible(true)` 与 `handleTaskCompleted` 会调用 `flushProgressBatch` 立即清空缓冲并应用，避免最后一批进度被丢弃。

### useTransferConflictStore

文件：[transfer-conflict.ts](../src/renderer/features/transfer/stores/transfer-conflict.ts)

职责：保存冲突项与对话框开关，以 Promise 回调方式协调冲突解决流程。

State

| 字段        | 类型                                                          | 默认值 | 说明                            |
| ----------- | ------------------------------------------------------------- | ------ | ------------------------------- |
| conflicts   | ConflictItem[]                                                | []     | 待解决的冲突列表                |
| dialogOpen  | boolean                                                       | false  | 冲突对话框是否打开              |
| _resolveRef | ((resolutions: ConflictResolution[] \| null) => void) \| null | null   | 内部持有的 Promise resolve 回调 |

Actions

| 方法       | 参数                                                                                    | 说明                                      |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| openDialog | conflicts: ConflictItem[], resolve: (resolutions: ConflictResolution[] \| null) => void | 打开对话框，写入 conflicts 与 _resolveRef |
| confirm    | resolutions: ConflictResolution[]                                                       | 清空 state，调用 _resolveRef(resolutions) |
| cancel     | 无                                                                                      | 清空 state，调用 _resolveRef(null)        |

使用模式：调用方先构造 `new Promise<ConflictResolution[] | null>((resolve) => openDialog(conflicts, resolve))`，由对话框 UI 在用户决策后调用 `confirm(resolutions)` 或 `cancel()` 触发 resolve，调用方 await 该 Promise 得到结果（null 表示取消）。`_resolveRef` 仅作为内部实现细节存在，外部不应直接读写。

### useHostKeyStore

文件：[host-key.ts](../src/renderer/features/host-key/stores/host-key.ts)

职责：维护主机密钥校验对话框的状态。

State

| 字段          | 类型                                                                               | 默认值                                                                                                                                           | 说明                                           |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| hostKeyDialog | HostKeyVerificationDialogState & { onConfirm?: () => void; onCancel?: () => void } | { open: false, type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT（'first-connect'）, hash: '', previousHash: undefined, sessionId: '', connectionId: '' } | 对话框状态，附加可选的 onConfirm/onCancel 回调 |

Actions

| 方法                         | 参数                                                                                               | 说明                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| setHostKeyVerificationDialog | state: Partial<HostKeyVerificationDialogState & { onConfirm?: () => void; onCancel?: () => void }> | 用 state 浅合并当前 hostKeyDialog |

HostKeyVerificationDialogState 类型定义在 [host-key-dialog.ts](../src/shared/types/host-key-dialog.ts)，字段：`open: boolean`、`type: HostKeyDialogType`（'first-connect' / 'mismatch'）、`hash: string`、`previousHash: string | undefined`、`sessionId: string`、`connectionId: string`。

## 主进程 Store

### electron-store（config）

文件：[store.ts](../src/main/stores/config/store.ts)、[types.ts](../src/main/stores/config/types.ts)、[persistence.ts](../src/main/stores/config/persistence.ts)、[ui-settings.ts](../src/main/stores/config/ui-settings.ts)、[validation.ts](../src/main/stores/config/validation.ts)

职责：在主进程中维护应用配置（连接、UI 偏好、传输并发、排序方式），采用"内存优先 + 定时落盘"策略。

StoreSchema（[types.ts](../src/main/stores/config/types.ts)）字段：`savedConnections: ConnectionConfig[]`、`uiSettings: UiSettings`、`transferSettings: TransferSettings`、`connectionSortOrder: SortOrder`。

默认值（`defaultStore`）：`savedConnections: []`、`uiSettings: defaultUiSettings`（`{ appearance: DEFAULT_THEME_VALUE（'system'）, locale: '' }`）、`transferSettings: { maxUploadConcurrency: 5, maxDownloadConcurrency: 5 }`（`TRANSFER_CONFIG.DEFAULT_CONCURRENCY`）、`connectionSortOrder: SORT_ORDER.NONE（'none'）`。

UiSettings（[settings.ts](../src/shared/types/settings.ts)）：`appearance: Theme`、`locale: SupportedLanguageLiteral | ''`。

TransferSettings（[settings.ts](../src/shared/types/settings.ts)）：`maxUploadConcurrency: number`、`maxDownloadConcurrency: number`。

核心内存访问函数（[store.ts](../src/main/stores/config/store.ts)）

| 函数               | 参数                                            | 返回             | 说明                                 |
| ------------------ | ----------------------------------------------- | ---------------- | ------------------------------------ |
| getFromMemory      | key: keyof StoreSchema                          | StoreSchema[key] | 读取内存中某字段                     |
| setToMemory        | key: keyof StoreSchema, value: StoreSchema[key] | void             | 写入内存并自动调用 markConfigChanged |
| getInMemoryConfig  | 无                                              | StoreSchema      | 读取整份内存配置                     |
| setInMemoryConfig  | config: StoreSchema                             | void             | 整体替换内存配置（不自动标记 dirty） |
| markConfigChanged  | 无                                              | void             | 标记配置已变更                       |
| resetConfigChanged | 无                                              | void             | 清除变更标记                         |
| hasConfigChanged   | 无                                              | boolean          | 是否存在未落盘变更                   |

持久化函数（[persistence.ts](../src/main/stores/config/persistence.ts)）

| 函数                     | 参数                                                       | 返回                          | 说明                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| initializeConfig         | 无                                                         | void                          | 从磁盘读取并校验后写入内存；失败时回退到默认值（locale 用 detectSystemLanguage 检测）                                                               |
| flushConfigToDisk        | 无                                                         | Result<void, ErrorInfo>       | 若 hasConfigChanged() 为 false 直接返回 ok；否则将内存配置写入 electron-store（savePassword=false 的连接剔除 password 字段），并 resetConfigChanged |
| saveConfig               | 无                                                         | void                          | 等价于 `void flushConfigToDisk()`                                                                                                                   |
| startAutoSave            | intervalMs: number = TIMEOUTS.AUTO_SAVE_INTERVAL（300000） | void                          | 启动定时器周期性调用 flushConfigToDisk；重复调用会先停止旧定时器                                                                                    |
| stopAutoSave             | 无                                                         | void                          | 停止自动保存定时器                                                                                                                                  |
| getUserInterfaceSettings | 无                                                         | Result<UiSettings, ErrorInfo> | 返回内存中 UI 设置的拷贝                                                                                                                            |
| setUserInterfaceSettings | settings: UiSettings                                       | Result<void, ErrorInfo>       | 经 isValidUiSettings 校验后写入内存                                                                                                                 |
| getConfigurationValue    | key: string                                                | Result<unknown, ErrorInfo>    | 按 STORE_KEY 读取；SAVED_CONNECTIONS 与 UI_SETTINGS 有专用拷贝逻辑，未知 key 返回 INVALID_CONFIG 错误                                               |
| setConfigurationValue    | key: string, value: unknown                                | Result<void, ErrorInfo>       | 按 STORE_KEY 写入；SAVED_CONNECTIONS 经 isValidConnection 过滤，UI_SETTINGS 经 isValidUiSettings 校验，未知 key 返回错误                            |

校验函数位于 [validation.ts](../src/main/stores/config/validation.ts)：`detectSystemLanguage()`、`isValidConnection(config)`、`isValidUiSettings(settings)`。

### known-hosts

文件：[known-hosts.ts](../src/main/stores/known-hosts.ts)

职责：基于 `electron-store`（name 为 `'known-hosts'`，defaults `{ knownHosts: [] }`）维护已知 SSH 主机密钥记录，并对记录做 sha256 校验和防篡改。

方法

| 方法                | 参数                               | 返回                                    | 说明                                                                                    |
| ------------------- | ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| getHostKeyRecord    | connectionId: string               | Result<HostKey \| undefined, ErrorInfo> | 按 connectionId 查找；若 checksum 与重算值不符则返回 HOST_KEY_ERROR                     |
| saveHostKeyRecord   | record: Omit<HostKey, 'createdAt'> | Result<void, ErrorInfo>                 | 写入或更新（按 connectionId 匹配）一条记录，自动填充 createdAt = Date.now() 与 checksum |
| removeHostKeyRecord | connectionId: string               | Result<void, ErrorInfo>                 | 按 connectionId 过滤删除                                                                |

HostKey 类型（[host-key.ts](../src/shared/types/host-key.ts)）：`connectionId: string`、`hash: string`、`createdAt: number`、`checksum?: string`。

## Store 依赖关系

- useUiStore
  - 读取 `window.electronAPI.config`（setAppearance / setLocale 通过 `STORE_KEY.UI_SETTINGS` 写回主进程）
  - 依赖 [ui.ts](../src/shared/constants/ui.ts)、[transfer.ts](../src/shared/constants/transfer.ts)（SIDEBAR_VIEW）等常量
- useSessionStore
  - 调用 `window.electronAPI.system.generateUuid`、`window.electronAPI.protocol.cancel`、`window.electronAPI.protocol.list`
  - 依赖 [session.ts](../src/shared/types/session.ts)、[file.ts](../src/shared/types/file.ts) 类型
- useConnectionStore
  - 调用 `window.electronAPI.config.get/set`（SAVED_CONNECTIONS、CONNECTION_SORT_ORDER）、`window.electronAPI.hostKey.delete`
  - 依赖 `@dnd-kit/sortable` 的 arrayMove
  - 依赖 [connection.ts](../src/shared/types/connection.ts) 类型
- useTransferStore
  - 调用 `window.electronAPI.transfer` 命名空间：setConcurrency、getTasks、getConcurrency、onTasksEnqueued、onProgress、onTaskCompleted、onTaskFailed、onTaskRemoved
  - 依赖内部模块 [transfer-progress-batch.ts](../src/renderer/features/transfer/stores/transfer-progress-batch.ts) 做进度批合并
  - 依赖 [transfer.ts](../src/shared/types/transfer.ts)、[transfer.ts](../src/shared/constants/transfer.ts) 类型与常量
- useTransferConflictStore
  - 不直接依赖 electronAPI；通过 openDialog 的 resolve 回调与传输流程交互
  - 依赖 [transfer.ts](../src/shared/types/transfer.ts) 的 ConflictItem、ConflictResolution 类型
- useHostKeyStore
  - 不直接依赖 electronAPI；状态由外部（host-key 流程）通过 setHostKeyVerificationDialog 写入
  - 依赖 [host-key-dialog.ts](../src/shared/types/host-key-dialog.ts) 与 [ui.ts](../src/shared/constants/ui.ts) 的 HOST_KEY_DIALOG_TYPE
- 主进程 config Store
  - 依赖 npm 包 `electron-store`
  - 通过 IPC 暴露给渲染进程的 `window.electronAPI.config.get/set`
  - 依赖 [validation.ts](../src/main/stores/config/validation.ts) 的校验函数与 [ui-settings.ts](../src/main/stores/config/ui-settings.ts) 的默认 UI 设置
- 主进程 known-hosts Store
  - 依赖 npm 包 `electron-store`
  - 通过 IPC 暴露给渲染进程的 `window.electronAPI.hostKey` 命名空间
  - 与 useConnectionStore 的 deleteConnection 联动（删除连接时同步删除主机密钥）

## 备注：与原任务描述的差异

为确保准确，下面列出本手册与本次任务输入描述之间的差异（手册以源码为准）：

- 任务描述称 `setAppearance/setLocale` 需要 `connectionSortOrder` 参数，但 [ui.ts](../src/renderer/stores/ui.ts) 中这两个方法签名分别为 `(appearance: Theme)` 与 `(locale: SupportedLanguageLiteral)`，均不接收 connectionSortOrder；它们内部读取对方字段后整体写入 `STORE_KEY.UI_SETTINGS`。
- 任务描述提到读取 `src/shared/types/ui.ts`，该文件实际不存在；Toast 类型定义在 [ui.ts](../src/renderer/stores/ui.ts) 内部，Theme / ToastType / FileType / HostKeyDialogType 等常量在 [ui.ts](../src/shared/constants/ui.ts)。
- 任务描述提到 `useTransferStore` "no sortBy/sortOrder fields"，已核实源码 [transfer.ts](../src/renderer/features/transfer/stores/transfer.ts) 的 TransferState 接口确实不含这两个字段；排序相关的 sortBy/sortOrder 仅出现在文件浏览器 hook [use-file-sort.ts](../src/renderer/features/file-explorer/hooks/use-file-sort.ts) 中。
