1. 进程安全基线
   - 渲染进程必须开启 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
   - 推荐在 `app.whenReady()` 前调用 `app.enableSandbox()` 全局启用沙箱
   - 渲染进程禁止直接 import `fs` / `path` / `os` / `child_process`

2. IPC 规范
   - IPC 通道名必须在共享常量文件中定义，禁止裸字符串
   - **IPC Handler 和 Preload 只做透传，禁止在 IPC 层直接写复杂业务逻辑、窗口操作或配置处理，应委托给 services、utils 或对应模块**
   - IPC Handler 保持透传，错误处理由 service 层负责，IPC 层不添加 try-catch
   - Preload 暴露的 API 必须白名单化，每个 IPC 调用包装为独立命名函数，禁止暴露原始 `ipcRenderer`

3. 安全防护
   - 必须拦截 `will-navigate` 和 `setWindowOpenHandler`，阻止非预期导航和新窗口
   - 必须设置 `setPermissionRequestHandler` 拒绝所有权限请求（或白名单化）
   - 渲染进程必须配置 Content-Security-Policy，生产环境禁止 `unsafe-inline` 脚本和 `unsafe-eval`；开发环境为支持 Vite HMR 允许放宽
   - 敏感数据（密码、Token）禁止写入 localStorage，必须使用系统密钥链或 `safeStorage` 加密存储

4. Node.js 兼容
   - 使用 Node.js 原生类型剥离时需配合 TypeScript 6.0+ 的 `--erasableSyntaxOnly`
