# Rivet

[![Build](https://github.com/RealChuan/Rivet/actions/workflows/build.yml/badge.svg)](https://github.com/RealChuan/Rivet/actions/workflows/build.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

Rivet 是一个跨平台（Windows / macOS / Linux）的远程服务器桌面文件浏览器，支持 **SFTP** 与 **WebDAV**。它把远端目录当作本地文件管理器来用：连接、浏览、上传下载、改名、删除、复制移动、冲突处理和传输管理都在同一个窗口完成。

- 简体中文 | [English](README.en.md)
- [架构说明](docs/architecture.md)
- [开发约定](AGENTS.md)

![Rivet 截图](docs/images/rivet.png)

## 功能

### 连接

- **SFTP**：密码、私钥 + 口令、SSH agent；首次连接的主机密钥确认与 known-hosts 记忆。
- **WebDAV**：Basic / Digest 认证、自定义基础路径、自签证书开关。
- 多连接管理；连接配置持久化，密码只在主进程经 `safeStorage` 加密存储，私钥只保存路径。

### 文件管理

- 列表 / 宫格视图，虚拟滚动、排序、框选与右键菜单。
- 新建文件夹、重命名、删除、复制、移动、刷新。
- 文件夹属性统计：文件数、文件夹数、总大小。
- 上传 / 下载冲突处理：覆盖、跳过、保留两者，可应用到全部。

### 传输

- 文件与文件夹的上传、下载，支持拖拽上传。
- 上传、下载各自独立的并发上限（1–10）。
- 任务进度、子文件进度、失败详情、取消与重试。
- 传输面板按会话分组，失败任务可查看完整错误信息。

### 体验

- 浅色 / 深色 / 跟随系统主题；Windows 11 / macOS 26+ 的原生毛玻璃效果。
- 中文 / English 界面。
- 单窗口、可调整侧栏、原生窗口控制；有活跃传输时关闭前会二次确认。

## 技术栈

| 层   | 选型                                                       |
| ---- | ---------------------------------------------------------- |
| 桌面 | Electron、electron-forge                                   |
| 界面 | React、TypeScript、Vite、Zustand、TanStack Query / Virtual |
| 协议 | ssh2、undici、fast-xml-parser                              |
| 日志 | electron-log（按天 + 按大小滚动）                          |

## 开发

环境要求：Node 24 LTS、pnpm 12。

```powershell
pnpm install
pnpm dev
pnpm run verify
```

- `pnpm run verify` 依次执行 typecheck、lint、单元测试、类型测试、i18n 检查、生产依赖审计与打包。
- E2E 需要 Docker：`pnpm e2e:servers` → `pnpm run build` → `pnpm test:e2e` → `pnpm e2e:servers:down`。
- 更多命令与工程约定见 [AGENTS.md](AGENTS.md)。

## 架构

主进程持有窗口、连接、文件系统、传输与秘密；渲染层只通过类型化 IPC 契约访问能力；协议差异收敛在 `FileProvider`。详见 [docs/architecture.md](docs/architecture.md)。

## 许可证

[GPL-3.0](LICENSE)
