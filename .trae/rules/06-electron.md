1. 进程安全
   - 渲染进程：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
   - `app.whenReady()` 前调用 `app.enableSandbox()`；渲染进程禁止 import Node.js 内置模块

2. IPC 规范
   - IPC 通道名在共享常量文件定义，禁止裸字符串
   - IPC Handler 和 Preload 只做透传，业务逻辑委托给 services/utils
   - Preload 暴露的 API 白名单化，每个 IPC 调用包装为独立函数

3. 安全防护
   - 拦截 `will-navigate`、`setWindowOpenHandler`；`setPermissionRequestHandler` 拒绝所有权限
   - 生产环境 CSP 禁止 `unsafe-inline` 脚本和 `unsafe-eval`
   - 敏感数据用系统密钥链或 `safeStorage`，禁止写入 localStorage
