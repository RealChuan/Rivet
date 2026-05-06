# E2E smoke

Requires Docker and a packaged build.

```powershell
pnpm e2e:servers
pnpm run build
pnpm test:e2e
pnpm e2e:servers:down
```

- SFTP: `127.0.0.1:2222`, `testuser` / `testpass`, 用户 chroot 到家目录，只有 `upload/` 可写
- WebDAV: `http://127.0.0.1:8080`, `testuser` / `testpass`

The first SFTP connect shows the host-key confirmation; the test clicks `host-key-confirm`.
写操作相关的用例会先在 UI 里进入 `upload/`，因为 atmoz/sftp 的 chroot 根目录不允许创建条目。
