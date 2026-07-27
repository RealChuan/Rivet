# IPC 通道参考手册

## 概述

本项目所有 IPC 通道名集中定义在 [index.ts](../src/shared/constants/ipc/index.ts) 汇总模块下，按业务模块拆分为 9 个子常量文件（位于 [src/shared/constants/ipc/](../src/shared/constants/ipc/)）。渲染进程通过 `window.electronAPI` 访问 preload 暴露的 API，类型契约定义在 [electron-api.ts](../src/shared/types/electron-api.ts)。Preload 通过 `contextBridge.exposeInMainWorld('electronAPI', …)` 注入命名空间，主进程在 [setupIpcHandlers](../src/main/ipc/index.ts) 中统一注册所有 handler。

## 通信方向说明

| 方向                  | 调用方式                                          | 触发机制                            | 是否返回     |
| --------------------- | ------------------------------------------------- | ----------------------------------- | ------------ |
| invoke（渲染→主进程） | `ipcRenderer.invoke` → `ipcMain.handle`           | 渲染进程发起请求并等待 Promise 解决 | 返回 Promise |
| send（渲染→主进程）   | `ipcRenderer.send` → `ipcMain.on`                 | 渲染进程单向通知主进程              | 单向无返回   |
| on（主进程→渲染）     | 主进程 `webContents.send` → 渲染 `ipcRenderer.on` | 主进程主动推送事件                  | 事件推送     |

## Protocol（协议操作）

通道常量：[protocol.ts](../src/shared/constants/ipc/protocol.ts) ｜ Preload：[protocol.ts](../src/preload/protocol.ts) ｜ 主进程 handler：[protocol.ts](../src/main/ipc/protocol.ts) ｜ 类型：`ProtocolAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名                                   | 方向   | 参数                                                                              | 返回值                                       | 说明                                                     |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `protocol:connect`                       | invoke | `config: ConnectionConfig`                                                        | `Promise<ProtocolResponse<OperationResult>>` | 建立远程协议连接，返回会话 ID 与状态码                   |
| `protocol:disconnect`                    | invoke | `sessionId: string`, `requestId?: string`                                         | `Promise<ProtocolResponse<void>>`            | 断开指定会话                                             |
| `protocol:list`                          | invoke | `sessionId: string`, `path: string`, `requestId?: string`                         | `Promise<ProtocolResponse<FileInfo[]>>`      | 列出远程目录                                             |
| `protocol:mkdir`                         | invoke | `sessionId: string`, `path: string`, `requestId?: string`                         | `Promise<ProtocolResponse<void>>`            | 在远程创建目录                                           |
| `protocol:rename`                        | invoke | `sessionId: string`, `file: FileInfo`, `newName: string`, `requestId?: string`    | `Promise<ProtocolResponse<void>>`            | 重命名远程文件                                           |
| `protocol:delete`                        | invoke | `sessionId: string`, `file: FileInfo`, `requestId?: string`                       | `Promise<ProtocolResponse<void>>`            | 删除远程文件                                             |
| `protocol:copy`                          | invoke | `sessionId: string`, `file: FileInfo`, `targetPath: string`, `requestId?: string` | `Promise<ProtocolResponse<void>>`            | 复制远程文件                                             |
| `protocol:move`                          | invoke | `sessionId: string`, `file: FileInfo`, `targetPath: string`, `requestId?: string` | `Promise<ProtocolResponse<void>>`            | 移动远程文件                                             |
| `protocol:cancel`                        | invoke | `requestId: string`                                                               | `Promise<void>`                              | 取消进行中的协议操作                                     |
| `protocol:calculate-folder-stats`        | invoke | `sessionId: string`, `path: string`                                               | `Promise<Result<void, ErrorInfo>>`           | 计算远程文件夹统计信息                                   |
| `protocol:cancel-calculate-folder-stats` | invoke | `sessionId: string`                                                               | `Promise<void>`                              | 取消文件夹统计任务                                       |
| `protocol:folder-stats-progress`         | on     | `data: FolderStatsProgress & { sessionId: string }`                               | （事件）订阅回调                             | 文件夹统计进度推送，preload 暴露 `onFolderStatsProgress` |

补充：preload 还提供 `onSessionDisconnected` 方法，监听全局事件 `events:session-disconnected`（详见 Events 节）。

### ProtocolResponse&lt;T&gt; 结构

定义见 [protocol-request.ts](../src/shared/types/protocol-request.ts)。为联合类型：

| 成员                         | `requestId` | `success` | `value`     | `error`     |
| ---------------------------- | ----------- | --------- | ----------- | ----------- |
| `ProtocolSuccessResponse<T>` | `string`    | `true`    | `T`         | `undefined` |
| `ProtocolErrorResponse`      | `string`    | `false`   | `undefined` | `ErrorInfo` |

类型守卫 `isProtocolResponseErr` 在同文件导出。

### OperationResult 结构

定义见 [operation-result.ts](../src/shared/types/operation-result.ts)。`connect` 成功时返回的载荷：

| 字段                  | 类型                    | 说明                                     |
| --------------------- | ----------------------- | ---------------------------------------- |
| `sessionId`           | `string`                | 连接成功时由主进程生成，失败时为空字符串 |
| `statusCode`          | `StatusCode`            | 数值状态码（见下文）                     |
| `detail`              | `SftpConnectDetail`     | 主机密钥指纹信息                         |
| `detail.hash`         | `string`                | 当前主机密钥指纹（SHA256）               |
| `detail.previousHash` | `string` \| `undefined` | 之前保存的指纹，用于检测密钥变更         |

### 状态码（数值）

定义见 [protocol-status.ts](../src/shared/constants/protocol-status.ts)。`statusCode` 为数值类型，联合类型为 `StatusCode`。

| 常量                           | 值     | 说明                         |
| ------------------------------ | ------ | ---------------------------- |
| `ProtocolStatus.OK`            | `2000` | 操作成功                     |
| `ProtocolStatus.FIRST_CONNECT` | `2001` | 首次连接（需要确认主机密钥） |
| `SftpStatus.HOST_KEY_MISMATCH` | `3000` | SFTP 主机密钥不匹配          |

## Transfer（文件传输）

通道常量：[transfer.ts](../src/shared/constants/ipc/transfer.ts) ｜ Preload：[transfer.ts](../src/preload/transfer.ts) ｜ 主进程 handler：[transfer.ts](../src/main/ipc/transfer.ts) ｜ 类型：`TransferAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

### 请求通道（invoke）

| 通道名                       | 方向   | 参数                                          | 返回值                       | 说明                                     |
| ---------------------------- | ------ | --------------------------------------------- | ---------------------------- | ---------------------------------------- |
| `transfer:add`               | invoke | `tasks: TransferTask[]`                       | `Promise<DeduplicateResult>` | 批量添加传输任务，返回新增与重复任务列表 |
| `transfer:cancel`            | invoke | `taskId: string`                              | `Promise<void>`              | 取消单个传输任务                         |
| `transfer:cancel-all`        | invoke | `sessionId?: string`                          | `Promise<void>`              | 取消所有（或指定会话下）任务             |
| `transfer:retry`             | invoke | `taskId: string`                              | `Promise<void>`              | 重试单个任务                             |
| `transfer:retry-all`         | invoke | `sessionId?: string`                          | `Promise<void>`              | 重试所有（或指定会话下）任务             |
| `transfer:get-tasks`         | invoke | `sessionId?: string`                          | `Promise<TransferTask[]>`    | 查询任务列表                             |
| `transfer:get-concurrency`   | invoke | `direction: TransferDirection`                | `Promise<number>`            | 查询指定方向（上传/下载）的并发上限      |
| `transfer:set-concurrency`   | invoke | `max: number`, `direction: TransferDirection` | `Promise<void>`              | 设置指定方向的并发上限                   |
| `transfer:check-local-files` | invoke | `localDir: string`                            | `Promise<LocalFileInfo[]>`   | 检查本地目录下文件信息                   |
| `transfer:get-last-dir`      | invoke | `key: LastDirKey`                             | `Promise<string \| null>`    | 读取上次使用的目录                       |
| `transfer:set-last-dir`      | invoke | `key: LastDirKey`, `dir: string`              | `Promise<void>`              | 写入上次使用的目录                       |

注：`TransferDirection` 取自常量 `TRANSFER_DIRECTION`，值为 `'upload' \| 'download'`；`LastDirKey` 取自常量 `LAST_DIR_KEY`，值为 `'lastUploadDir' \| 'lastDownloadDir'`，二者均定义于 [transfer.ts](../src/shared/constants/transfer.ts)。

### 事件通道（on）

| 通道名                      | 方向 | 回调参数                                                                | 说明                                                                           |
| --------------------------- | ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `transfer:tasks-enqueued`   | on   | `tasks: TransferTask[]`                                                 | 任务入队后推送                                                                 |
| `transfer:progress`         | on   | `data: TransferProgressData`                                            | 传输进度推送（受 `TRANSFER_CONFIG.PROGRESS_THROTTLE_MS` 节流）                 |
| `transfer:task-completed`   | on   | `data: { taskId: string; transferredSize?: number; fileSize?: number }` | 单个任务完成                                                                   |
| `transfer:task-failed`      | on   | `data: { taskId: string; errorMessage: string }`                        | 单个任务失败                                                                   |
| `transfer:task-removed`     | on   | `data: { taskId: string }`                                              | 任务被移除                                                                     |
| `transfer:has-active-tasks` | on   | （无参）                                                                | 通知存在活动任务，主进程在 [lifecycle.ts](../src/main/app/lifecycle.ts) 中推送 |

### 关联数据结构

均定义于 [transfer.ts](../src/shared/types/transfer.ts)。

| 类型                   | 字段                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TransferProgressData` | `taskId: string` ｜ `transferredSize: number` ｜ `fileSize?: number` ｜ `speed?: number` ｜ `totalFileCount?: number` ｜ `completedFileCount?: number` ｜ `activeFileCount?: number` ｜ `waitingFileCount?: number` ｜ `activeOperations?: OperationProgressInfo[]`                                                                       |
| `DeduplicateResult`    | `added: TransferTask[]` ｜ `duplicates: TransferTask[]`                                                                                                                                                                                                                                                                                   |
| `LocalFileInfo`        | `name: string` ｜ `size: number` ｜ `type: FileType`                                                                                                                                                                                                                                                                                      |
| `TransferTask`         | `id`、`sessionId`、`direction`、`localPath`、`localDir?`、`remotePath`、`itemName`、`itemType`、`status`、`conflictAction?`、`renamedName?`、`fileSize`、`transferredSize`、`speed?`、`createdAt`、`startedAt?`、`errorMessage?`、`totalFileCount?`、`completedFileCount?`、`activeFileCount?`、`waitingFileCount?`（字段类型详见源文件） |

## Config（配置读写）

通道常量：[config.ts](../src/shared/constants/ipc/config.ts) ｜ Preload：[config.ts](../src/preload/config.ts) ｜ 主进程 handler：[config.ts](../src/main/ipc/config.ts) ｜ 类型：`ConfigAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名       | 方向   | 参数                              | 返回值                                | 说明       |
| ------------ | ------ | --------------------------------- | ------------------------------------- | ---------- |
| `config:get` | invoke | `key: StoreKey`                   | `Promise<Result<unknown, ErrorInfo>>` | 读取配置项 |
| `config:set` | invoke | `key: StoreKey`, `value: unknown` | `Promise<Result<void, ErrorInfo>>`    | 写入配置项 |

说明：源文件 [config.ts](../src/shared/constants/ipc/config.ts) 中 `CONFIG_CHANNELS` 仅定义了 `GET` 与 `SET` 两个通道，**不存在 `DELETE` 常量**，也未在主进程 handler 或 preload 中暴露删除接口。

### StoreKey 常量

定义见 [app.ts](../src/shared/constants/app.ts) 的 `STORE_KEY` 对象，类型 `StoreKey` 为其字面量联合。

| 常量                              | 值                      |
| --------------------------------- | ----------------------- |
| `STORE_KEY.SAVED_CONNECTIONS`     | `'savedConnections'`    |
| `STORE_KEY.UI_SETTINGS`           | `'uiSettings'`          |
| `STORE_KEY.TRANSFER_SETTINGS`     | `'transferSettings'`    |
| `STORE_KEY.KNOWN_HOSTS`           | `'knownHosts'`          |
| `STORE_KEY.CONNECTION_SORT_ORDER` | `'connectionSortOrder'` |

## Dialog（原生对话框）

通道常量：[dialog.ts](../src/shared/constants/ipc/dialog.ts) ｜ Preload：[dialog.ts](../src/preload/dialog.ts) ｜ 主进程 handler：[dialog.ts](../src/main/ipc/dialog.ts) ｜ 类型：`DialogAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名                    | 方向   | 参数                                                                   | 返回值                                                                                | 说明                   |
| ------------------------- | ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- |
| `dialog:show-open-dialog` | invoke | `options: { properties: string[]; defaultPath?: string \| undefined }` | `Promise<Result<{ canceled: boolean; filePaths: string[] } \| undefined, ErrorInfo>>` | 弹出系统打开文件对话框 |
| `dialog:show-save-dialog` | invoke | `options: unknown`（主进程签名接受 `SaveDialogOptions`）               | `Promise<Result<{ canceled: boolean; filePath?: string } \| undefined, ErrorInfo>>`   | 弹出系统保存文件对话框 |

补充：preload 还提供 `getPathForFile: (file: File) => string`，该方法**不走 IPC**，直接调用 electron 的 `webUtils.getPathForFile` 将 `File` 对象映射为本地路径。

## Host Key（SSH 主机密钥）

通道常量：[host-key.ts](../src/shared/constants/ipc/host-key.ts) ｜ Preload：[host-key.ts](../src/preload/host-key.ts) ｜ 主进程 handler：[host-key.ts](../src/main/ipc/host-key.ts) ｜ 类型：`HostKeyAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名            | 方向   | 参数                                             | 返回值                             | 说明                       |
| ----------------- | ------ | ------------------------------------------------ | ---------------------------------- | -------------------------- |
| `host-key:save`   | invoke | `record: { connectionId: string; hash: string }` | `Promise<Result<void, ErrorInfo>>` | 保存主机密钥指纹记录       |
| `host-key:delete` | invoke | `connectionId: string`                           | `Promise<Result<void, ErrorInfo>>` | 删除指定连接的主机密钥记录 |

关联类型 `HostKey` 见 [host-key.ts](../src/shared/types/host-key.ts)，字段包含 `connectionId`、`hash`、`createdAt`、可选 `checksum`。

## System（系统路径）

通道常量：[system.ts](../src/shared/constants/ipc/system.ts) ｜ Preload：[system.ts](../src/preload/system.ts) ｜ 主进程 handler：[system.ts](../src/main/ipc/system.ts) ｜ 类型：`SystemAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名                    | 方向   | 参数 | 返回值                               | 说明                                               |
| ------------------------- | ------ | ---- | ------------------------------------ | -------------------------------------------------- |
| `system:get-temp-dir`     | invoke | 无   | `Promise<Result<string, ErrorInfo>>` | 获取系统临时目录                                   |
| `system:get-download-dir` | invoke | 无   | `Promise<Result<string, ErrorInfo>>` | 获取下载目录                                       |
| `system:supports-glass`   | invoke | 无   | `Promise<boolean>`                   | 查询当前系统是否支持毛玻璃效果                     |
| `system:generate-uuid`    | invoke | 无   | `Promise<string>`                    | 生成 UUID（主进程通过 `crypto.randomUUID()` 生成） |

说明：`SystemAPI` 接口实际暴露 4 个方法（`getTempDir`、`getDownloadDir`、`generateUuid`、`supportsGlass`），全部通过 IPC 调用。其中 `generate-uuid` 在主进程 handler 内部调用 Node.js `crypto.randomUUID()` 后将字符串经 IPC 返回渲染进程。

## Crypto（密码加密）

通道常量：[crypto.ts](../src/shared/constants/ipc/crypto.ts) ｜ Preload：[crypto.ts](../src/preload/crypto.ts) ｜ 主进程 handler：[crypto.ts](../src/main/ipc/crypto.ts) ｜ 类型：`CryptoAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

| 通道名                    | 方向   | 参数                | 返回值                               | 说明                               |
| ------------------------- | ------ | ------------------- | ------------------------------------ | ---------------------------------- |
| `crypto:encrypt-password` | invoke | `password: string`  | `Promise<Result<string, ErrorInfo>>` | 加密密码（底层使用 `safeStorage`） |
| `crypto:decrypt-password` | invoke | `encrypted: string` | `Promise<Result<string, ErrorInfo>>` | 解密密码                           |

## Window（窗口控制）

通道常量：[window.ts](../src/shared/constants/ipc/window.ts) ｜ Preload：[window.ts](../src/preload/window.ts) ｜ 主进程 handler：[window.ts](../src/main/ipc/window.ts) ｜ 类型：`WindowAPI` in [electron-api.ts](../src/shared/types/electron-api.ts)

### 请求通道

| 通道名                | 方向   | 参数                                                                                      | 返回值                                                | 说明                                                                                                   |
| --------------------- | ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `window:get-meta`     | invoke | 无                                                                                        | `Promise<{ windowId: string; route: string }>`        | 获取当前窗口的 ID 与路由元信息；preload 同时暴露 `getMeta` 与 `refreshMeta`，**两者均调用此 IPC 通道** |
| `window:get-state`    | invoke | 无                                                                                        | `Promise<{ isMaximized: boolean; platform: string }>` | 查询窗口最大化状态与平台                                                                               |
| `window:create-child` | invoke | `options: { id: string; route: string; width?: number; height?: number; title?: string }` | `Promise<string>`                                     | 创建子窗口，返回 `options.id`                                                                          |
| `window:close-child`  | invoke | `id: string`                                                                              | `Promise<boolean>`                                    | 关闭指定子窗口                                                                                         |

### 事件通道（on / send）

| 通道名                 | 方向 | 参数 / 回调                       | 说明                                                                                                                  |
| ---------------------- | ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `window:minimize`      | send | 无                                | 渲染进程请求最小化当前窗口                                                                                            |
| `window:maximize`      | send | 无                                | 渲染进程请求最大化/还原当前窗口                                                                                       |
| `window:close`         | send | 无                                | 渲染进程请求关闭当前窗口                                                                                              |
| `window:quit`          | send | 无                                | 渲染进程请求退出应用                                                                                                  |
| `window:state-changed` | on   | `state: { isMaximized: boolean }` | 主进程在窗口状态变化时推送（见 [window-factory.ts](../src/main/app/window-factory.ts)），preload 暴露 `onStateChange` |

说明：当前 [window.ts](../src/shared/constants/ipc/window.ts) 中**未定义 `GET_APP_VERSION` 通道**。`WINDOW_CHANNELS` 的全部 9 个常量（`MINIMIZE`、`MAXIMIZE`、`CLOSE`、`QUIT`、`GET_STATE`、`STATE_CHANGED`、`CREATE_CHILD`、`CLOSE_CHILD`、`GET_META`）均已在主进程 handler 中注册或在主进程主动发送事件。

## Events（全局事件）

通道常量：[events.ts](../src/shared/constants/ipc/events.ts) ｜ 渲染监听：[protocol.ts](../src/preload/protocol.ts) 的 `onSessionDisconnected`

| 通道名                        | 方向 | 回调参数                                                                             | 说明                                                                                                                                                    |
| ----------------------------- | ---- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events:session-disconnected` | on   | `event: { sessionId: string; connectionId: string; protocol: string; name: string }` | 主进程检测到会话断开时向所有窗口广播（见 [session-manager.ts](../src/main/services/session-manager.ts)），preload `protocol.onSessionDisconnected` 订阅 |

## Preload API 命名空间

`window.electronAPI` 在 [preload/index.ts](../src/preload/index.ts) 中通过 `contextBridge.exposeInMainWorld` 注入 8 个命名空间：

| 命名空间   | Preload 文件                              | 说明                                         |
| ---------- | ----------------------------------------- | -------------------------------------------- |
| `protocol` | [protocol.ts](../src/preload/protocol.ts) | 远程协议连接、文件操作、文件夹统计与断连事件 |
| `transfer` | [transfer.ts](../src/preload/transfer.ts) | 文件传输任务管理与进度事件                   |
| `config`   | [config.ts](../src/preload/config.ts)     | 应用配置读写                                 |
| `dialog`   | [dialog.ts](../src/preload/dialog.ts)     | 原生打开/保存对话框与文件路径转换            |
| `hostKey`  | [host-key.ts](../src/preload/host-key.ts) | SSH 已知主机密钥管理                         |
| `system`   | [system.ts](../src/preload/system.ts)     | 系统目录、UUID 生成、毛玻璃支持查询          |
| `crypto`   | [crypto.ts](../src/preload/crypto.ts)     | 密码加解密                                   |
| `window`   | [window.ts](../src/preload/window.ts)     | 窗口控制、子窗口管理、状态事件               |

事件监听全部通过 [listener-manager.ts](../src/preload/listener-manager.ts) 统一注册与清理，`beforeunload` 时会自动调用 `listenerManager.cleanup()` 移除所有 `ipcRenderer.on` 监听器。

## 关联类型文件索引

| 类型                                                                                                                                                           | 文件                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `ConnectionConfig`                                                                                                                                             | [connection.ts](../src/shared/types/connection.ts)             |
| `FileInfo`                                                                                                                                                     | [file.ts](../src/shared/types/file.ts)                         |
| `FolderStatsProgress`                                                                                                                                          | [folder-stats.ts](../src/shared/types/folder-stats.ts)         |
| `ProtocolResponse<T>`                                                                                                                                          | [protocol-request.ts](../src/shared/types/protocol-request.ts) |
| `OperationResult`、`SftpConnectDetail`                                                                                                                         | [operation-result.ts](../src/shared/types/operation-result.ts) |
| `Result<T,E>`、`Ok<T>`、`Err<E>`、`ErrorInfo`                                                                                                                  | [result.ts](../src/shared/types/result.ts)                     |
| `TransferTask`、`TransferProgressData`、`DeduplicateResult`、`LocalFileInfo`、`UploadOperation`、`OperationProgressInfo`、`ConflictItem`、`ConflictResolution` | [transfer.ts](../src/shared/types/transfer.ts)                 |
| `HostKey`                                                                                                                                                      | [host-key.ts](../src/shared/types/host-key.ts)                 |
| `ElectronAPI`、`ProtocolAPI`、`WindowAPI`、`TransferAPI`、`DialogAPI`                                                                                          | [electron-api.ts](../src/shared/types/electron-api.ts)         |
