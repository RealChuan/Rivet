# Store 状态参考手册

## 概述

项目使用 Zustand 5 进行状态管理。所有 Store 导出 `use[Feature]Store` hook，禁止导出裸 store 实例。

### 使用规范

```typescript
// 正确：使用 selector 订阅
const theme = useUiStore(state => state.appearance)

// 正确：多值 selector 使用 shallow
const { tasks, runningTaskCount } = useTransferStore(
  state => ({ tasks: state.tasks, runningTaskCount: state.runningTaskCount }),
  shallow
)

// 错误：禁止直接解构
const { theme } = useUiStore() // 任何 state 变化都会触发重渲染
```

---

## 渲染进程 Store

### useUiStore

文件：[ui.ts](file:///c:/demo/Rivet/src/renderer/stores/ui.ts)

全局 UI 状态管理。

#### State

| 字段                   | 类型                       | 默认值                         | 说明                                      |
| ---------------------- | -------------------------- | ------------------------------ | ----------------------------------------- |
| `appearance`           | `Theme`                    | `THEME.SYSTEM`                 | 主题（`'light'` / `'dark'` / `'system'`） |
| `locale`               | `SupportedLanguageLiteral` | `DEFAULT_LANGUAGE` (`'en-US'`) | 语言                                      |
| `connectionPanelWidth` | `number`                   | `260`                          | 连接面板宽度                              |
| `transferPanelWidth`   | `number`                   | `260`                          | 传输面板宽度                              |
| `queueDrawerOpen`      | `boolean`                  | `false`                        | 传输队列抽屉是否展开                      |
| `queueDrawerWidth`     | `number`                   | `360`                          | 传输队列抽屉宽度                          |
| `initialized`          | `boolean`                  | `false`                        | 是否已初始化                              |
| `activeView`           | `SidebarView`              | `SIDEBAR_VIEW.CONNECTIONS`     | 当前活动视图                              |
| `toasts`               | `Toast[]`                  | `[]`                           | Toast 通知列表                            |

#### Actions

| 方法                      | 参数                                                               | 说明                                                                   |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `setAppearance`           | `appearance: Theme, connectionSortOrder: SortOrder`                | 设置主题，同步持久化（需要 connectionSortOrder 以完整保存 UiSettings） |
| `setLocale`               | `locale: SupportedLanguageLiteral, connectionSortOrder: SortOrder` | 设置语言，同步持久化（需要 connectionSortOrder 以完整保存 UiSettings） |
| `setConnectionPanelWidth` | `width: number`                                                    | 设置连接面板宽度                                                       |
| `setTransferPanelWidth`   | `width: number`                                                    | 设置传输面板宽度                                                       |
| `setActiveView`           | `view: SidebarView`                                                | 切换活动视图                                                           |
| `initialize`              | `settings: Partial<UiSettings>`                                    | 初始化 UI 设置                                                         |
| `addToast`                | `toast: Omit<Toast, 'id'>`                                         | 添加 Toast 通知                                                        |
| `removeToast`             | `id: string`                                                       | 移除 Toast 通知                                                        |

> **注意**：`setAppearance` 和 `setLocale` 需要 `connectionSortOrder` 参数，因为保存 `UiSettings` 时需要完整的 `{ appearance, locale, connectionSortOrder }` 对象。

#### Toast 结构

`Toast` 接口定义在 [ui.ts](file:///c:/demo/Rivet/src/renderer/stores/ui.ts) 中，包含 `id`、`type`（ToastType）、`message`、可选的 `duration`（0 = 不自动关闭）和 `timer` 字段。

---

### useSessionStore

文件：[session.ts](file:///c:/demo/Rivet/src/renderer/features/session/stores/session.ts)

管理活跃会话列表和文件浏览状态。

#### State

| 字段                   | 类型             | 默认值 | 说明                          |
| ---------------------- | ---------------- | ------ | ----------------------------- |
| `sessions`             | `Session[]`      | `[]`   | 活跃会话列表                  |
| `activeSessionId`      | `string \| null` | `null` | 当前活跃会话 ID               |
| `currentListRequestId` | `string \| null` | `null` | 当前 list 请求 ID（用于取消） |

#### Session 结构

[Session](file:///c:/demo/Rivet/src/shared/types/session.ts) 包含 `sessionId`、`connectionId`、`currentPath`、`files`（FileInfo[]）、`isLoading`、`isOperating`、`isConnected`、`error` 字段。

> **注意**：`Session` 类型没有 `protocol` 和 `name` 字段。`protocol` 和 `name` 信息在 [ConnectionConfig](file:///c:/demo/Rivet/src/shared/types/connection.ts) 中。

#### Actions

| 方法                      | 参数                                       | 说明                                      |
| ------------------------- | ------------------------------------------ | ----------------------------------------- |
| `setActiveSession`        | `sessionId: string`                        | 设置活跃会话                              |
| `updateCurrentPath`       | `sessionId: string, path: string`          | 更新当前路径                              |
| `setFiles`                | `sessionId: string, files: FileInfo[]`     | 设置文件列表（会经过 sanitizeFiles 过滤） |
| `setLoading`              | `sessionId: string, loading: boolean`      | 设置加载状态                              |
| `setOperating`            | `sessionId: string, operating: boolean`    | 设置操作中状态                            |
| `setError`                | `sessionId: string, error: string \| null` | 设置错误（有错误时 isConnected=false）    |
| `refreshCurrentDirectory` | `sessionId: string`                        | 刷新当前目录（自动取消前一个请求）        |
| `addSession`              | `session: Session`                         | 添加会话（自动设为活跃）                  |
| `removeSession`           | `sessionId: string`                        | 移除会话                                  |

#### Getters

| 方法                       | 返回值                 | 说明               |
| -------------------------- | ---------------------- | ------------------ |
| `getSessionByConnectionId` | `Session \| undefined` | 按连接 ID 查找会话 |
| `getSessionById`           | `Session \| undefined` | 按会话 ID 查找会话 |

---

### useConnectionStore

文件：[connection.ts](file:///c:/demo/Rivet/src/renderer/features/session/stores/connection.ts)

管理连接配置的 CRUD 和排序。

#### State

| 字段                      | 类型                       | 默认值            | 说明                  |
| ------------------------- | -------------------------- | ----------------- | --------------------- |
| `connections`             | `ConnectionConfig[]`       | `[]`              | 连接配置列表          |
| `pendingConnectionConfig` | `ConnectionConfig \| null` | `null`            | 待编辑/新建的连接配置 |
| `pendingIsEditing`        | `boolean`                  | `false`           | 是否为编辑模式        |
| `closeConnectionDialog`   | `boolean`                  | `false`           | 是否关闭连接对话框    |
| `sortOrder`               | `SortOrder`                | `SORT_ORDER.NONE` | 排序顺序              |

#### Actions

| 方法                         | 参数                            | 说明                             |
| ---------------------------- | ------------------------------- | -------------------------------- |
| `addConnection`              | `config: ConnectionConfig`      | 添加连接配置                     |
| `updateConnection`           | `config: ConnectionConfig`      | 更新连接配置                     |
| `deleteConnection`           | `connectionId: string`          | 删除连接配置（同步删除 hostKey） |
| `loadSavedConnections`       | —                               | 从主进程加载已保存的连接         |
| `saveConnectionConfigs`      | —                               | 保存连接配置到主进程             |
| `setPendingConnectionConfig` | `config, isEditing`             | 设置待编辑的连接配置             |
| `setCloseConnectionDialog`   | `close: boolean`                | 设置关闭对话框标记               |
| `setSortOrder`               | `order: SortOrder`              | 设置排序顺序（同步持久化）       |
| `reorderConnections`         | `activeId, overId`              | 拖拽排序（@dnd-kit）             |
| `sortConnections`            | `order: SortOrderWithDirection` | 按名称排序                       |

#### Getters

| 方法                | 返回值                          | 说明               |
| ------------------- | ------------------------------- | ------------------ |
| `getConnectionById` | `ConnectionConfig \| undefined` | 按 ID 查找连接配置 |

---

### useFileExplorerStore

文件：[file-explorer.ts](file:///c:/demo/Rivet/src/renderer/features/file-explorer/stores/file-explorer.ts)

文件浏览器的 UI 状态。

#### State

| 字段              | 类型                         | 默认值            | 说明             |
| ----------------- | ---------------------------- | ----------------- | ---------------- |
| `sortField`       | `FileExplorerSortFieldBasic` | `SORT_FIELD.NAME` | 排序字段         |
| `sortOrder`       | `SortOrderWithDirection`     | `SORT_ORDER.ASC`  | 排序方向         |
| `viewMode`        | `ViewMode`                   | `VIEW_MODE.LIST`  | 视图模式         |
| `showHiddenFiles` | `boolean`                    | `false`           | 是否显示隐藏文件 |
| `selectedFiles`   | `Set<string>`                | `new Set()`       | 选中的文件名集合 |

#### Actions

| 方法                    | 参数                                | 说明                                 |
| ----------------------- | ----------------------------------- | ------------------------------------ |
| `setSortField`          | `field: FileExplorerSortFieldBasic` | 设置排序字段（切换字段时重置为 ASC） |
| `setSortOrder`          | `order: SortOrderWithDirection`     | 设置排序方向                         |
| `toggleSortOrder`       | —                                   | 切换排序方向                         |
| `setViewMode`           | `mode: ViewMode`                    | 设置视图模式                         |
| `setShowHiddenFiles`    | `show: boolean`                     | 设置是否显示隐藏文件                 |
| `toggleShowHiddenFiles` | —                                   | 切换隐藏文件显示                     |
| `setSelectedFiles`      | `files: Set<string>`                | 设置选中文件集合                     |
| `addSelectedFile`       | `filename: string`                  | 添加选中文件                         |
| `removeSelectedFile`    | `filename: string`                  | 移除选中文件                         |
| `clearSelectedFiles`    | —                                   | 清空选中文件                         |
| `toggleSelectedFile`    | `filename: string`                  | 切换文件选中状态                     |

---

### useTransferStore

文件：[transfer.ts](file:///c:/demo/Rivet/src/renderer/features/transfer/stores/transfer.ts)

传输任务状态管理，与主进程 TransferService 通过 IPC 事件同步。

#### State

| 字段                     | 类型                                   | 默认值                                      | 说明                                       |
| ------------------------ | -------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| `tasks`                  | `TransferTask[]`                       | `[]`                                        | 传输任务列表                               |
| `taskProgress`           | `Map<string, TaskProgress>`            | `new Map()`                                 | 任务进度（独立于任务列表，避免列表重渲染） |
| `sessionTaskSummaries`   | `SessionTaskSummary[]`                 | `[]`                                        | 按会话分组的任务摘要                       |
| `sessionIds`             | `string[]`                             | `[]`                                        | 有任务的会话 ID 列表                       |
| `runningTaskCount`       | `number`                               | `0`                                         | 运行中的任务数                             |
| `selectedSessionId`      | `string \| null`                       | `null`                                      | 当前选中的会话 ID                          |
| `activeOperations`       | `Map<string, OperationProgressInfo[]>` | `new Map()`                                 | 文件夹任务的活跃操作                       |
| `isVisible`              | `boolean`                              | `true`                                      | 传输页面是否可见                           |
| `activeTab`              | `TransferDirection`                    | `TRANSFER_DIRECTION.UPLOAD`                 | 当前标签页（上传/下载）                    |
| `maxUploadConcurrency`   | `number`                               | `TRANSFER_CONFIG.DEFAULT_CONCURRENCY` (`5`) | 上传最大并发数                             |
| `maxDownloadConcurrency` | `number`                               | `TRANSFER_CONFIG.DEFAULT_CONCURRENCY` (`5`) | 下载最大并发数                             |

> **注意**：`useTransferStore` 没有 `sortBy` 和 `sortOrder` 字段，排序在组件层面处理。

#### TaskProgress 结构

`TaskProgress` 接口定义在 [transfer.ts](file:///c:/demo/Rivet/src/renderer/features/transfer/stores/transfer.ts) 中，包含 `transferredSize`、可选的 `speed`/`fileSize`/`totalFileCount`/`completedFileCount`/`activeFileCount`/`waitingFileCount` 字段。

#### SessionTaskSummary 结构

`SessionTaskSummary` 接口定义在 [transfer.ts](file:///c:/demo/Rivet/src/renderer/features/transfer/stores/transfer.ts) 中，包含 `sessionId`、`running`、`failed`、`total` 字段。

#### Actions

| 方法                        | 参数                           | 说明                                 |
| --------------------------- | ------------------------------ | ------------------------------------ |
| `setSelectedSessionId`      | `sessionId`                    | 设置选中的会话                       |
| `setVisible`                | `visible: boolean`             | 设置可见性（变为可见时刷新缓冲进度） |
| `setActiveTab`              | `direction: TransferDirection` | 设置当前标签页                       |
| `setMaxUploadConcurrency`   | `value: number`                | 设置上传并发数（同步到主进程）       |
| `setMaxDownloadConcurrency` | `value: number`                | 设置下载并发数（同步到主进程）       |
| `handleTasksEnqueued`       | `tasks: TransferTask[]`        | 处理任务入队事件                     |
| `handleProgress`            | `data: TransferProgressData`   | 处理进度事件（250ms 批量合并）       |
| `handleTaskCompleted`       | `data`                         | 处理任务完成事件                     |
| `handleTaskFailed`          | `data`                         | 处理任务失败事件                     |
| `handleTaskRemoved`         | `data`                         | 处理任务移除事件                     |
| `loadExistingTasks`         | —                              | 加载主进程已有的任务                 |
| `loadConcurrency`           | —                              | 加载上传/下载并发数                  |
| `startListening`            | —                              | 开始监听 IPC 事件，返回取消函数      |

#### Selectors

| Selector                           | 说明                     |
| ---------------------------------- | ------------------------ |
| `selectTasksForSessionByDirection` | 按会话 ID 和方向筛选任务 |

#### 进度批量合并

`handleProgress` 不直接更新状态，而是将进度数据推入 `progressBuffer`，250ms 定时器批量合并后更新，避免高频 IPC 事件导致渲染性能问题。当 `isVisible` 为 `false` 时，仅缓冲不刷新，变为可见时立即刷新。

---

### useTransferConflictStore

文件：[transfer-conflict.ts](file:///c:/demo/Rivet/src/renderer/features/transfer/stores/transfer-conflict.ts)

传输冲突对话框状态，使用 Promise-based 模式。

#### State

| 字段          | 类型                              | 默认值  | 说明                 |
| ------------- | --------------------------------- | ------- | -------------------- |
| `conflicts`   | `ConflictItem[]`                  | `[]`    | 冲突项列表           |
| `dialogOpen`  | `boolean`                         | `false` | 对话框是否打开       |
| `_resolveRef` | `((resolutions) => void) \| null` | `null`  | Promise resolve 引用 |

#### Actions

| 方法         | 参数                                | 说明                              |
| ------------ | ----------------------------------- | --------------------------------- |
| `openDialog` | `conflicts, resolve`                | 打开冲突对话框，保存 resolve 回调 |
| `confirm`    | `resolutions: ConflictResolution[]` | 确认冲突处理，调用 resolve        |
| `cancel`     | —                                   | 取消冲突处理，resolve(null)       |

#### 使用模式

```typescript
const resolutions = await new Promise<ConflictResolution[] | null>(resolve => {
  useTransferConflictStore.getState().openDialog(conflicts, resolve)
})
```

---

### useHostKeyStore

文件：[host-key.ts](file:///c:/demo/Rivet/src/renderer/features/host-key/stores/host-key.ts)

SSH 主机密钥验证对话框状态。

#### State

| 字段            | 类型                                                         | 默认值                                                           | 说明       |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| `hostKeyDialog` | `HostKeyVerificationDialogState & { onConfirm?, onCancel? }` | `{ open: false, type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT, ... }` | 对话框状态 |

#### HostKeyVerificationDialogState 结构

[HostKeyVerificationDialogState](file:///c:/demo/Rivet/src/shared/types/host-key-dialog.ts) 包含 `open`（boolean）、`type`（HostKeyDialogType: `'first-connect'` | `'mismatch'`）、`hash`、`previousHash`（string | undefined）、`sessionId`、`connectionId` 字段。

#### Actions

| 方法                           | 参数                                      | 说明                     |
| ------------------------------ | ----------------------------------------- | ------------------------ |
| `setHostKeyVerificationDialog` | `Partial<HostKeyVerificationDialogState>` | 更新对话框状态（浅合并） |

---

## 主进程 Store

### electron-store (config)

文件：[store.ts](file:///c:/demo/Rivet/src/main/stores/config/store.ts)

使用 `electron-store` 进行持久化存储，配合内存缓存。

#### 存储结构 (StoreSchema)

[StoreSchema](file:///c:/demo/Rivet/src/main/stores/config/types.ts) 包含 `savedConnections`（ConnectionConfig[]）、`uiSettings`（[UiSettings](file:///c:/demo/Rivet/src/shared/types/settings.ts)）、`transferSettings`（[TransferSettings](file:///c:/demo/Rivet/src/shared/types/settings.ts)）三个字段。

#### UiSettings 结构

[UiSettings](file:///c:/demo/Rivet/src/shared/types/settings.ts) 包含 `appearance`（Theme）、`locale`（SupportedLanguageLiteral | ''）、`connectionSortOrder`（SortOrder）字段。

#### TransferSettings 结构

[TransferSettings](file:///c:/demo/Rivet/src/shared/types/settings.ts) 包含 `maxUploadConcurrency`（number）、`maxDownloadConcurrency`（number）字段。

#### 核心函数

| 函数                         | 说明                |
| ---------------------------- | ------------------- |
| `getFromMemory<T>(key)`      | 从内存读取配置      |
| `setToMemory<T>(key, value)` | 写入内存 + 标记变更 |
| `markConfigChanged()`        | 标记配置已变更      |
| `hasConfigChanged()`         | 检查配置是否有变更  |

#### 持久化函数

文件：[persistence.ts](file:///c:/demo/Rivet/src/main/stores/config/persistence.ts)

| 函数                                | 说明                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `initializeConfig()`                | 从磁盘加载配置到内存                                                      |
| `flushConfigToDisk()`               | 将内存配置写入磁盘（仅写入变更的，`savePassword=false` 的连接密码被剥离） |
| `saveConfig()`                      | 包装 `flushConfigToDisk`                                                  |
| `startAutoSave(intervalMs?)`        | 启动定时自动保存（默认 `AUTO_SAVE_INTERVAL` = `300000ms`）                |
| `stopAutoSave()`                    | 停止自动保存                                                              |
| `getConfigurationValue(key)`        | 通用配置读取                                                              |
| `setConfigurationValue(key, value)` | 通用配置写入                                                              |

### known-hosts

文件：[known-hosts.ts](file:///c:/demo/Rivet/src/main/stores/known-hosts.ts)

SSH 主机密钥记录存储，使用独立的 `electron-store` 实例（`name: 'known-hosts'`）。

| 方法                  | 参数                             | 返回值                                    | 说明                                 |
| --------------------- | -------------------------------- | ----------------------------------------- | ------------------------------------ |
| `getHostKeyRecord`    | `connectionId: string`           | `Result<HostKey \| undefined, ErrorInfo>` | 获取主机密钥记录（含 checksum 校验） |
| `saveHostKeyRecord`   | `record: { connectionId, hash }` | `Result<void, ErrorInfo>`                 | 保存主机密钥记录（含 checksum 计算） |
| `removeHostKeyRecord` | `connectionId`                   | `Result<void, ErrorInfo>`                 | 删除主机密钥记录                     |

#### HostKey 结构

[HostKey](file:///c:/demo/Rivet/src/shared/types/host-key.ts) 包含 `connectionId`（string）、`hash`（string）、`createdAt`（number）、可选的 `checksum`（string）字段。

---

## Store 依赖关系

```
useUiStore
  ├── 依赖 window.electronAPI.config（保存 UI 设置时需要完整 UiSettings）
  └── setAppearance/setLocale 需要 connectionSortOrder 参数

useConnectionStore
  ├── 依赖 window.electronAPI.config（持久化连接配置）
  └── 依赖 window.electronAPI.hostKey（删除连接时清理密钥）

useSessionStore
  └── 依赖 window.electronAPI.protocol（刷新目录）

useTransferStore
  ├── 依赖 window.electronAPI.transfer（IPC 事件监听 + 并发数设置）
  └── 依赖 useSessionStore（通过 sessionId 关联）

useTransferConflictStore
  └── 无外部依赖（纯 UI 状态）

useFileExplorerStore
  └── 无外部依赖（纯 UI 状态）

useHostKeyStore
  └── 无外部依赖（纯 UI 状态）
```
