# AGENTS.md

## 环境与命令

- Node 24 LTS、pnpm 12；Docker 仅用于 E2E。
- 开发：`pnpm install`、`pnpm dev`。
- 门禁：`pnpm run verify`（typecheck → lint → test → test:typecheck → i18n → audit → build）；分项命令见 `package.json`。
- E2E：`pnpm e2e:servers` → `pnpm run build` → `pnpm test:e2e` → `pnpm e2e:servers:down`，详见 `e2e/README.md`。

## 不变量

- `src/renderer/api/` 是唯一允许出现 `window.electronAPI` 的地方。
- IPC 契约只在 `src/shared/contract/`；主进程只在 `src/main/ipc/register.ts` 注册通道。
- preload 零业务；秘密只在主进程，渲染层不接触密文或 safeStorage。
- 单窗口；用户可见错误按 `ErrorCode` 翻译，只允许附加 `detail.serverMessage`。
- 全仓禁止 `any`、`!`、`@ts-ignore`、`console.*`、`TODO`；不新增 `as unknown as`。

## 依赖

- 小版本与补丁可随时升级，门禁绿即可合并。
- 大版本先确认工具链（typescript-eslint、eslint、vite、electron-forge、Electron 等）支持；不兼容时保持原大版本并记录原因。
- 新依赖先征得维护者同意；`radix-ui` 单包是 UI 原语唯一入口。

## 文件地图

- 契约 `src/shared/contract/`；主进程 `src/main/{app,ipc,protocol,providers,stores,transfer,services}/`；渲染层 `src/renderer/{api,features,components,layout,hooks,stores}/`；E2E `e2e/`。

## 约定

- 翻译 key 只改 `src/renderer/i18n/locales/*.json`，`pnpm run i18n:types` 生成 `resources.d.ts`。
- 测试里的 `ResizeObserver` 是 no-op 桩；需要尺寸的用例自行 stub 并手动触发。

## 禁止

- 擅自合并、推送、发布。
- 绕过门禁或删除失败测试。
- 引入未批准的依赖。
