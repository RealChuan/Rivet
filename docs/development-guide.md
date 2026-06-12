# 开发指南

## 环境搭建

### 前置要求

- Node.js >= 20.0.0
- pnpm（随 `corepack enable` 或 `npm install -g pnpm` 安装）

### 安装依赖

```bash
pnpm install
```

`postinstall` 脚本会自动执行 `electron-builder install-app-deps` 编译原生模块。

### 启动开发

```bash
pnpm run dev
```

这会并行启动：

1. Vite 开发服务器（端口 5173，支持 HMR）
2. Electron 主进程（等待 Vite 就绪后启动）

## 开发工作流

### 修改代码 → CI 验证

1. 修改代码（一个逻辑单元内的所有文件）
2. 运行 `pnpm run ci`（格式化 + lint 修复 + 类型检查 + 测试 + i18n 提取 + 构建）
3. CI 未通过 → 在该单元内继续修复
4. CI 通过 → 标记完成

**铁律**：`pnpm run ci` 是最终门禁，未通过时禁止标记任务完成。

### 单独运行检查

```bash
pnpm run format          # Prettier 格式化
pnpm run lint            # ESLint 检查
pnpm run lint:fix        # ESLint 自动修复
pnpm run typecheck:all   # 全部类型检查（渲染进程 + 主进程）
pnpm run test:run        # 运行测试
pnpm run build           # 构建项目
```

## 目录约定

### 新功能放哪里

新功能优先放到最贴近的已有目录：

| 功能类型         | 目录                                    |
| ---------------- | --------------------------------------- |
| 渲染进程功能模块 | `src/renderer/features/<feature-name>/` |
| 主进程服务       | `src/main/services/`                    |
| IPC Handler      | `src/main/ipc/`                         |
| Preload API      | `src/preload/`                          |
| 共享常量         | `src/shared/constants/`                 |
| 共享类型         | `src/shared/types/`                     |
| 共享工具         | `src/shared/utils/`                     |
| 通用组件         | `src/renderer/components/common/`       |
| 基础 UI 组件     | `src/renderer/components/ui/`           |
| 全局 Hooks       | `src/renderer/hooks/`                   |
| 全局 Store       | `src/renderer/stores/`                  |

### 文件命名规范

| 类型               | 命名           | 示例               |
| ------------------ | -------------- | ------------------ |
| 文件夹             | kebab-case     | `file-explorer/`   |
| React 组件         | PascalCase.tsx | `FileExplorer.tsx` |
| 工具函数/服务/常量 | kebab-case.ts  | `format-date.ts`   |
| Store              | kebab-case.ts  | `ui.ts`            |

### 功能模块结构

每个功能模块遵循统一结构：

```
features/<feature-name>/
├── components/     # 该功能的组件
├── hooks/          # 该功能的自定义 Hooks
└── stores/         # 该功能的 Zustand Store
```

## 如何新增一个 IPC 通道

以新增 `protocol:stat`（获取文件详情）为例：

### 1. 定义 IPC 通道常量

[src/shared/constants/ipc/protocol.ts](file:///c:/demo/Rivet/src/shared/constants/ipc/protocol.ts)：

```typescript
export const PROTOCOL_CHANNELS = {
  // ... 已有通道
  STAT: 'protocol:stat',
} as const
```

### 2. 定义类型

[src/shared/types/](file:///c:/demo/Rivet/src/shared/types/) 下添加请求/响应类型。

### 3. 主进程 IPC Handler

[src/main/ipc/protocol.ts](file:///c:/demo/Rivet/src/main/ipc/protocol.ts)：

```typescript
ipcMain.handle(PROTOCOL_CHANNELS.STAT, (_event, sessionId: string, path: string) => {
  return protocolService.stat(sessionId, path)
})
```

**注意**：IPC Handler 只做透传，不写业务逻辑。错误处理由 service 层负责，IPC 层不添加 try-catch。

### 4. 主进程 Service 层

在 [AbstractProtocol](file:///c:/demo/Rivet/src/main/services/protocol/abstract-protocol.ts) 添加 `stat` 模板方法和 `statImpl` 抽象方法，在 [SftpProtocol](file:///c:/demo/Rivet/src/main/services/protocol/SftpProtocol.ts) / [WebdavProtocol](file:///c:/demo/Rivet/src/main/services/protocol/WebdavProtocol.ts) 中实现。

在 [ProtocolService](file:///c:/demo/Rivet/src/main/services/protocol/protocol-service.ts) 添加 `stat()` 方法。

### 5. Preload API

[src/preload/protocol.ts](file:///c:/demo/Rivet/src/preload/protocol.ts)：

```typescript
stat: (sessionId: string, path: string, requestId?: string) =>
  ipcRenderer.invoke(PROTOCOL_CHANNELS.STAT, sessionId, path, requestId),
```

### 6. 类型声明

[electron-api.ts](file:///c:/demo/Rivet/src/shared/types/electron-api.ts) 的 `ProtocolAPI` 接口添加 `stat` 方法。

### 7. 渲染进程使用

```typescript
const response = await window.electronAPI.protocol.stat(sessionId, path)
```

## 如何新增一个功能模块

以新增"书签"功能为例：

### 1. 创建目录结构

```
src/renderer/features/bookmark/
├── components/
├── hooks/
└── stores/
```

### 2. 创建 Store

`src/renderer/features/bookmark/stores/bookmark.ts`：

```typescript
import { create } from 'zustand'

interface BookmarkStore {
  bookmarks: Bookmark[]
  addBookmark: (bookmark: Bookmark) => void
  removeBookmark: (id: string) => void
}

export const useBookmarkStore = create<BookmarkStore>(set => ({
  bookmarks: [],
  addBookmark: bookmark => {
    set(state => ({ bookmarks: [...state.bookmarks, bookmark] }))
  },
  removeBookmark: id => {
    set(state => ({ bookmarks: state.bookmarks.filter(b => b.id !== id) }))
  },
}))
```

### 3. 创建组件和 Hooks

在 `components/` 和 `hooks/` 下创建对应文件。

### 4. 添加 i18n Key

在 [src/renderer/i18n/locales/en-US.json](file:///c:/demo/Rivet/src/renderer/i18n/locales/en-US.json) 和 [zh-CN.json](file:///c:/demo/Rivet/src/renderer/i18n/locales/zh-CN.json) 中添加 `bookmark.*` 相关的翻译。新增页面后必须同步更新所有语言文件，禁止只改一种语言。

### 5. 集成到布局

在 `ActivityBar` 或 `MainLayout` 中添加入口。

## 如何新增一种协议

以新增 FTP 协议为例：

### 1. 添加协议常量

[src/shared/constants/protocol.ts](file:///c:/demo/Rivet/src/shared/constants/protocol.ts) 下添加 `PROTOCOL.FTP`。

### 2. 实现 AbstractProtocol

[src/main/services/protocol/](file:///c:/demo/Rivet/src/main/services/protocol/) 下新建 `FtpProtocol.ts`：

```typescript
export class FtpProtocol extends AbstractProtocol<FTPClient> {
  readonly protocolType = PROTOCOL.FTP

  // 实现所有 *Impl 方法
  protected async listImpl(client, path, basePath) { ... }
  protected async mkdirImpl(client, path, basePath) { ... }
  // ...
}
```

### 3. 注册到 ProtocolService

[protocol-service.ts](file:///c:/demo/Rivet/src/main/services/protocol/protocol-service.ts) 的 `getProtocol()` 中添加 FTP 分支。

### 4. 更新类型

[src/shared/types/](file:///c:/demo/Rivet/src/shared/types/) 下更新 `ConnectionConfig` 等类型，添加 FTP 相关字段。

### 5. 更新连接对话框

渲染进程 `ConnectionDialog` 添加 FTP 选项。

## 调试技巧

### 主进程日志

主进程使用 `electron-log` 封装的 `logger`，日志写入文件：

```typescript
import { logger } from '@main/utils/index.js'

logger.info('message', { data })
logger.warn('warning', { data })
logger.error('error', { data })
logger.debug('debug', { data })
logger.catch(error, { context }) // 格式化错误日志
```

日志文件路径：`app.getPath('userData')/logs/main.log`，文件和控制台级别均为 `info`。

### 渲染进程 DevTools

开发模式下按 `Ctrl+Shift+I`（Windows/Linux）或 `Cmd+Option+I`（macOS）打开 DevTools。

### 渲染进程日志

渲染进程日志通过 `logger` 转发到主进程统一记录，生产环境不留 `console.log`。

### Sentry

主进程和渲染进程均初始化了 Sentry，未捕获异常会自动上报。

### 测试

```bash
pnpm run test:run              # 运行全部测试
pnpm run test:main             # 仅主进程测试
pnpm run test:renderer         # 仅渲染进程测试
pnpm run test:shared           # 仅共享层测试
pnpm run test:coverage         # 生成覆盖率报告
```

Electron 依赖通过 [src/shared/test-utils/mocks/](file:///c:/demo/Rivet/src/shared/test-utils/mocks/) 下的 mock 模块处理，Vitest 配置中通过 alias 映射。

## 构建与打包

### 构建

```bash
pnpm run build
```

三步构建：

1. `vite build` — 渲染进程 → `dist/renderer/`
2. `vite build --config vite.preload.config.ts` — Preload → `dist/preload/index.cjs`
3. `tsc -p tsconfig.main.json && tsc-alias -p tsconfig.main.json` — 主进程 → `dist/`

项目有两个 TypeScript 配置：

- `tsconfig.json` — 渲染进程 + shared
- `tsconfig.main.json` — 主进程 + preload

### 打包

```bash
pnpm run package          # 当前平台
pnpm run package:win      # Windows
pnpm run package:linux    # Linux
pnpm run package:mac      # macOS
```

输出目录：`release/`

## 编码规范要点

详细规范见 [.trae/rules/](file:///c:/demo/Rivet/.trae/rules/) 目录，核心要点：

- **TypeScript**：`strict: true`，禁止隐式 `any`，禁止裸 `as` 断言，禁止 `enum`（用 `as const` 对象替代），启用 `erasableSyntaxOnly` 和 `verbatimModuleSyntax`
- **React**：禁止 `forwardRef`（React 19 支持 ref 作为普通 prop），禁止无意义的手动 `useMemo`/`useCallback`
- **Zustand**：组件内必须使用 selector 订阅，多值 selector 用 `shallow` 比较
- **Tailwind 4**：配置在 CSS `@theme` 中，无 `tailwind.config.js`，复杂条件类名用 `tailwind-merge` + `clsx`
- **i18next**：UI 文本禁止硬编码，Key 命名 `feature.subFeature.element`
- **Electron**：渲染进程禁止直接 import `fs`/`path`/`os`/`child_process`，IPC 通道名禁止裸字符串
