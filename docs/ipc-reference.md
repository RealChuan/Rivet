# IPC 通道参考手册

## 概述

所有 IPC 通道名定义在 [src/shared/constants/ipc/](../src/shared/constants/ipc/) 下，按模块拆分。渲染进程通过 `window.electronAPI` 访问，类型定义在 [electron-api.ts](../src/shared/types/electron-api.ts)。

### 通信方向说明

| 标记   | 方向          | 方式                                                  |
| ------ | ------------- | ----------------------------------------------------- |
| invoke | 渲染 → 主进程 | `ipcRenderer.invoke` → `ipcMain.handle`，返回 Promise |
| send   | 渲染 → 主进程 | `ipcRenderer.send` → `ipcMain.on`，单向无返回         |
| on     | 主进程 → 渲染 | `win.webContents.send` → `ipcRenderer.on`，事件推送   |

---

## Protocol（协议操作）

通道常量：[protocol.ts](../src/shared/constants/ipc/protocol.ts)

| 通道名                | 方向   | 参数                                                                        | 返回值                              | 说明             |
| --------------------- | ------ | --------------------------------------------------------------------------- | ----------------------------------- | ---------------- |
| `protocol:connect`    | invoke | `config: ConnectionConfig`                                                  | `ProtocolResponse<OperationResult>` | 连接远程服务器   |
| `protocol:disconnect` | invoke | `sessionId: string, requestId?: string`                                     | `ProtocolResponse<void>`            | 断开连接         |
| `protocol:list`       | invoke | `sessionId: string, path: string, requestId?: string`                       | `ProtocolResponse<FileInfo[]>`      | 列出目录内容     |
| `protocol:mkdir`      | invoke | `sessionId: string, path: string, requestId?: string`                       | `ProtocolResponse<void>`            | 创建目录         |
| `protocol:rename`     | invoke | `sessionId: string, file: FileInfo, newName: string, requestId?: string`    | `ProtocolResponse<void>`            | 重命名文件/目录  |
| `protocol:delete`     | invoke | `sessionId: string, file: FileInfo, requestId?: string`                     | `ProtocolResponse<void>`            | 删除文件/目录    |
| `protocol:copy`       | invoke | `sessionId: string, file: FileInfo, targetPath: string, requestId?: string` | `ProtocolResponse<void>`            | 复制文件/目录    |
| `protocol:move`       | invoke | `sessionId: string, file: FileInfo, targetPath: string, requestId?: string` | `ProtocolResponse<void>`            | 移动文件/目录    |
| `protocol:cancel`     | invoke | `requestId: string`                                                         | `Promise<void>`                     | 取消进行中的请求 |

### ProtocolResponse 结构

[ProtocolResponse](../src/shared/types/protocol-request.ts)`<T>` 是 `ProtocolSuccessResponse<T> | ProtocolErrorResponse` 联合类型，包含 `requestId`、`success`、`value`、`error` 字段。完整定义见源文件。

### connect 返回的 OperationResult

[OperationResult](../src/shared/types/operation-result.ts) 包含 `sessionId`（string）、`statusCode`（[StatusCode](../src/shared/constants/protocol-status.ts)，数字类型）和 `detail`（[SftpConnectDetail](../src/shared/types/operation-result.ts)）。

> **注意**：`statusCode` 是数字类型（`ProtocolStatus.OK = 2000` / `ProtocolStatus.FIRST_CONNECT = 2001` / `SftpStatus.HOST_KEY_MISMATCH = 3000`），不是字符串。

---

## Transfer（文件传输）

通道常量：[transfer.ts](../src/shared/constants/ipc/transfer.ts)

### 请求通道

| 通道名                       | 方向   | 参数                                        | 返回值              | 说明                         |
| ---------------------------- | ------ | ------------------------------------------- | ------------------- | ---------------------------- |
| `transfer:add`               | invoke | `tasks: TransferTask[]`                     | `DeduplicateResult` | 添加传输任务                 |
| `transfer:cancel`            | invoke | `taskId: string`                            | `Promise<void>`     | 取消单个任务                 |
| `transfer:cancel-all`        | invoke | `sessionId?: string`                        | `Promise<void>`     | 取消所有任务（可按会话过滤） |
| `transfer:retry`             | invoke | `taskId: string`                            | `Promise<void>`     | 重试失败任务                 |
| `transfer:retry-all`         | invoke | `sessionId?: string`                        | `Promise<void>`     | 重试所有失败任务             |
| `transfer:get-tasks`         | invoke | `sessionId?: string`                        | `TransferTask[]`    | 获取任务列表                 |
| `transfer:get-concurrency`   | invoke | `direction: TransferDirection`              | `number`            | 获取并发数                   |
| `transfer:set-concurrency`   | invoke | `max: number, direction: TransferDirection` | `Promise<void>`     | 设置最大并发数               |
| `transfer:check-local-files` | invoke | `localDir: string`                          | `LocalFileInfo[]`   | 检查本地文件冲突             |
| `transfer:get-last-dir`      | invoke | `key: LastDirKey`                           | `string \| null`    | 获取上次使用的目录           |
| `transfer:set-last-dir`      | invoke | `key: LastDirKey, dir: string`              | `Promise<void>`     | 设置上次使用的目录           |

### 事件通道（主进程 → 渲染进程）

| 通道名                      | 方向 | 数据类型                                                          | 说明                         |
| --------------------------- | ---- | ----------------------------------------------------------------- | ---------------------------- |
| `transfer:tasks-enqueued`   | on   | `TransferTask[]`                                                  | 新任务入队                   |
| `transfer:progress`         | on   | `TransferProgressData`                                            | 传输进度更新                 |
| `transfer:task-completed`   | on   | `{ taskId: string; transferredSize?: number; fileSize?: number }` | 任务完成                     |
| `transfer:task-failed`      | on   | `{ taskId: string; errorMessage: string }`                        | 任务失败                     |
| `transfer:task-removed`     | on   | `{ taskId: string }`                                              | 任务移除                     |
| `transfer:has-active-tasks` | on   | (无)                                                              | 仍有活跃任务（用于关闭拦截） |

### TransferProgressData 结构

[TransferProgressData](../src/shared/types/transfer.ts) 包含 `taskId`、`transferredSize`、可选的 `fileSize`/`speed`/`totalFileCount`/`completedFileCount`/`activeFileCount`/`waitingFileCount`/`activeOperations` 字段。完整定义见源文件。

### DeduplicateResult 结构

[DeduplicateResult](../src/shared/types/transfer.ts) 包含 `added: TransferTask[]` 和 `duplicates: TransferTask[]`。

### LocalFileInfo 结构

[LocalFileInfo](../src/shared/types/transfer.ts) 包含 `name`、`size`、`type`（FileType）字段。

---

## Config（配置读写）

通道常量：[config.ts](../src/shared/constants/ipc/config.ts)

| 通道名       | 方向   | 参数                            | 返回值                       | 说明     |
| ------------ | ------ | ------------------------------- | ---------------------------- | -------- |
| `config:get` | invoke | `key: StoreKey`                 | `Result<unknown, ErrorInfo>` | 读取配置 |
| `config:set` | invoke | `key: StoreKey, value: unknown` | `Result<void, ErrorInfo>`    | 写入配置 |

> **注意**：虽然 `CONFIG_CHANNELS` 定义了 `DELETE = 'config:delete'`，但 IPC Handler 和 Preload 中均未注册/暴露此通道。`ConfigAPI` 接口只有 `get` 和 `set`。

### StoreKey 常量

定义在 [app.ts](../src/shared/constants/app.ts)：

| Key                           | 类型                 | 说明                        |
| ----------------------------- | -------------------- | --------------------------- |
| `STORE_KEY.SAVED_CONNECTIONS` | `ConnectionConfig[]` | 已保存的连接配置            |
| `STORE_KEY.UI_SETTINGS`       | `UiSettings`         | UI 设置（主题、语言、排序） |
| `STORE_KEY.TRANSFER_SETTINGS` | `TransferSettings`   | 传输设置（上传/下载并发数） |
| `STORE_KEY.KNOWN_HOSTS`       | `HostKey[]`          | SSH 主机密钥记录            |

---

## Dialog（原生对话框）

通道常量：[dialog.ts](../src/shared/constants/ipc/dialog.ts)

| 通道名                    | 方向   | 参数                                             | 返回值                                                                       | 说明               |
| ------------------------- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------ |
| `dialog:show-open-dialog` | invoke | `{ properties: string[]; defaultPath?: string }` | `Result<{ canceled: boolean; filePaths: string[] } \| undefined, ErrorInfo>` | 打开文件选择对话框 |
| `dialog:show-save-dialog` | invoke | `{ defaultPath?: string \| undefined }`          | `Result<{ canceled: boolean; filePath?: string } \| undefined, ErrorInfo>`   | 打开保存对话框     |

> **注意**：`DialogAPI` 还包含 `getPathForFile(file: File): string`，这是通过 `webUtils.getPathForFile` 直接调用，不经过 IPC。

---

## Host Key（SSH 主机密钥）

通道常量：[host-key.ts](../src/shared/constants/ipc/host-key.ts)

| 通道名            | 方向   | 参数                                     | 返回值                    | 说明             |
| ----------------- | ------ | ---------------------------------------- | ------------------------- | ---------------- |
| `host-key:save`   | invoke | `{ connectionId: string; hash: string }` | `Result<void, ErrorInfo>` | 保存主机密钥记录 |
| `host-key:delete` | invoke | `connectionId: string`                   | `Result<void, ErrorInfo>` | 删除主机密钥记录 |

---

## System（系统路径）

通道常量：[system.ts](../src/shared/constants/ipc/system.ts)

| 通道名                    | 方向   | 参数 | 返回值                      | 说明             |
| ------------------------- | ------ | ---- | --------------------------- | ---------------- |
| `system:get-temp-dir`     | invoke | (无) | `Result<string, ErrorInfo>` | 获取临时目录路径 |
| `system:get-download-dir` | invoke | (无) | `Result<string, ErrorInfo>` | 获取下载目录路径 |

> **注意**：`SystemAPI` 只有 `getTempDir` 和 `getDownloadDir`，不存在 `system:get-is-packaged` 通道。

---

## Crypto（密码加密）

通道常量：[crypto.ts](../src/shared/constants/ipc/crypto.ts)

| 通道名                    | 方向   | 参数                | 返回值                      | 说明                      |
| ------------------------- | ------ | ------------------- | --------------------------- | ------------------------- |
| `crypto:encrypt-password` | invoke | `password: string`  | `Result<string, ErrorInfo>` | 使用 safeStorage 加密密码 |
| `crypto:decrypt-password` | invoke | `encrypted: string` | `Result<string, ErrorInfo>` | 使用 safeStorage 解密密码 |

---

## Window（窗口控制）

通道常量：[window.ts](../src/shared/constants/ipc/window.ts)

### 请求通道

| 通道名                | 方向   | 参数                                                                             | 返回值                                       | 说明                                    |
| --------------------- | ------ | -------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| `window:get-meta`     | invoke | (无)                                                                             | `{ windowId: string; route: string }`        | 获取窗口元数据（仅被 refreshMeta 调用） |
| `window:minimize`     | send   | (无)                                                                             | —                                            | 最小化窗口                              |
| `window:maximize`     | send   | (无)                                                                             | —                                            | 最大化/还原窗口                         |
| `window:close`        | send   | (无)                                                                             | —                                            | 关闭窗口                                |
| `window:quit`         | send   | (无)                                                                             | —                                            | 退出应用                                |
| `window:get-state`    | invoke | (无)                                                                             | `{ isMaximized: boolean; platform: string }` | 获取窗口状态                            |
| `window:create-child` | invoke | `{ id: string; route: string; width?: number; height?: number; title?: string }` | `Promise<string>`                            | 创建子窗口                              |
| `window:close-child`  | invoke | `id: string`                                                                     | `Promise<boolean>`                           | 关闭子窗口                              |

### 事件通道

| 通道名                 | 方向 | 数据类型                   | 说明         |
| ---------------------- | ---- | -------------------------- | ------------ |
| `window:state-changed` | on   | `{ isMaximized: boolean }` | 窗口状态变化 |

> **注意**：虽然 `WINDOW_CHANNELS` 定义了 `GET_APP_VERSION = 'window:get-app-version'`，但 IPC Handler 和 Preload 中均未注册/暴露此通道。`WindowAPI` 没有 `getAppVersion` 方法。

---

## Events（全局事件）

通道常量：[events.ts](../src/shared/constants/ipc/events.ts)

| 通道名                 | 方向 | 数据类型                                                                      | 说明         |
| ---------------------- | ---- | ----------------------------------------------------------------------------- | ------------ |
| `session-disconnected` | on   | `{ sessionId: string; connectionId: string; protocol: string; name: string }` | 会话意外断开 |

---

## Preload API 命名空间

渲染进程通过 `window.electronAPI` 访问，各命名空间对应文件：

| 命名空间                      | Preload 文件                              | 说明                                                                                       |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `window.electronAPI.protocol` | [protocol.ts](../src/preload/protocol.ts) | 协议操作 + 会话断开事件                                                                    |
| `window.electronAPI.transfer` | [transfer.ts](../src/preload/transfer.ts) | 传输任务 + 5 个事件监听 + onHasActiveTasks                                                 |
| `window.electronAPI.config`   | [config.ts](../src/preload/config.ts)     | 配置读写（get / set）                                                                      |
| `window.electronAPI.dialog`   | [dialog.ts](../src/preload/dialog.ts)     | 原生对话框 + getPathForFile                                                                |
| `window.electronAPI.hostKey`  | [host-key.ts](../src/preload/host-key.ts) | 主机密钥管理                                                                               |
| `window.electronAPI.system`   | [system.ts](../src/preload/system.ts)     | 系统路径 + generateUuid（crypto.randomUUID，不经过 IPC）                                   |
| `window.electronAPI.crypto`   | [crypto.ts](../src/preload/crypto.ts)     | 密码加密/解密                                                                              |
| `window.electronAPI.window`   | [window.ts](../src/preload/window.ts)     | 窗口控制 + 状态变化事件 + getMeta（读 location.hash，不经过 IPC）+ refreshMeta（通过 IPC） |

> **注意**：`system.generateUuid` 不经过 IPC，在渲染进程内直接通过 `crypto.randomUUID()` 实现。`window.getMeta` 不经过 IPC，直接读取 `window.location.hash`；`window.refreshMeta` 通过 IPC 从主进程获取窗口元数据。
