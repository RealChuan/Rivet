# Rivet 架构

## 1. 进程边界

- **主进程**：持有窗口、文件系统、SSH/WebDAV 连接、传输执行、配置与秘密。只通过契约转发能力，不渲染 UI。
- **preload**：只做 `contextBridge` 暴露类型化 API，不写业务逻辑，不直接访问 Node 能力。
- **渲染进程**：React + Zustand + TanStack Query。远程目录状态归 Query，客户端 UI 状态归 Zustand；不直接读文件系统。
- **shared**：契约、领域类型、常量、纯工具。不得依赖 Electron、Node 专属模块或 React。

## 2. 契约与 IPC

通道真源是共享契约；主进程只有一个注册入口。所有 invoke 返回统一 `Result` 信封，失败带 `AppError`。渲染层只消费 `code`，用户文案按 code 翻译；`message` 只进日志。事件统一 `namespace.method`，只由主进程发往唯一主窗口。

## 3. 协议层

`FileProvider` 是协议边界：连接、列目录、stat、读写、重命名、删除、复制/移动。provider 工厂按协议创建实现，SFTP 与 WebDAV 不互相感知。请求注册表拥有取消与超时：渲染层取消映射成 `cancel` 请求，超时在主进程收敛为 `REQUEST_TIMEOUT`。

主机密钥是两阶段：`hostVerifier` 只做同步判定；未知/不匹配以 `HOST_KEY_*` 错误返回，渲染层确认后写 known-hosts 并重连。known-hosts 以 `host:port` + 算法为键。

## 4. 传输

任务状态机显式（waiting/running/completed/failed/cancelled）。上传/下载各自有方向信号量，并发上限持久化在设置里。进度由主进程聚合后节流推送；渲染层只合并快照，不自己算总进度。冲突策略在入队/执行前决定，执行器不弹 UI。

## 5. 渲染层

`api/` 是唯一允许出现 `window.electronAPI` 的地方；组件只调用 api。目录数据用 `useQuery(['list', sessionId, path])`，失效按 session 批量触发。文件视图是 `FileView` + 列表/宫格，共用固定行高虚拟化与框选。传输面板用可变行高虚拟化，按 index 估算高度。

## 6. 配置与秘密

三份 JSON：设置、连接、known-hosts。统一由 `JsonStore` 读写：zod 校验、300ms 去抖、临时文件 + rename 原子写、损坏备份 `.bak`。秘密只经主进程 `safeStorage`，以 `v1:` 前缀存进连接文件的 `secrets`；不可用时绝不落盘，连接记录派生 `askPasswordOnConnect`。私钥只存路径。

## 7. 窗口与主题

单窗口。Windows 11 使用 Window Controls Overlay 以保留 Snap Layouts；macOS 使用隐藏标题栏 + 原生红绿灯；其他平台回退原生边框。渲染层标题栏只在需要时占位，主题切换同时更新原生主题、overlay 颜色与背景材质。关闭守卫在主进程：有活跃传输时发 `app.closeRequested`，渲染层取消任务后调 `app.confirmClose`。

## 8. 三条数据流

- **目录读取**：渲染层 query → 契约 → 协议服务 → provider → 结果映射 → query 缓存。
- **传输进度**：执行器 → 进度聚合器 → 节流事件 → 渲染层任务 store。
- **连接与主机密钥**：表单 → `protocol.connect` → hostVerifier → `HOST_KEY_*` 错误 → 确认框 → `hostKey.trust` → 重连。
