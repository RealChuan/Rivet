# E2E smoke

Requires Docker and a packaged build.

```powershell
pnpm run e2e:servers
pnpm run build
pnpm run test:e2e
pnpm run e2e:servers:down
```

- SFTP: `127.0.0.1:2222`，`testuser` / `testpass`，用户 chroot 到家目录，只有 `upload/` 可写
- SSH（终端用例）: `127.0.0.1:2223`，`testuser` / `testpass`，sftp 与 shell 同端口——终端复用会话的主机与端口，而 `atmoz/sftp` 只放行 sftp 子系统
- SMB: `127.0.0.1:1445`，共享名 `rivet`，`testuser` / `testpass`；共享目录挂载到 `e2e/servers/smb-share`
  - Samba 显式限制为 SMB2（`server min/max protocol = SMB2`），与当前 v9u-smb2 provider 的能力一致
  - 关闭 dperson 默认的 `fruit` / `recycle` VFS 模块，共享只剩普通 SMB2 语义（`recycle` 会把删除的文件留在目录里）
  - `ntlm auth = yes` 允许 NTLMv1/2，避免测试客户端因服务端 NTLM 策略差异误报
  - 用例覆盖列表、上传、删除文件与空目录
- WebDAV: `http://127.0.0.1:8080`，`testuser` / `testpass`
- S3: `http://127.0.0.1:9000`，桶 `rivet`，path-style，任意 Access Key 都能连
  - 用 `adobe/s3mock`：`COM_ADOBE_TESTING_S3MOCK_STORE_INITIALBUCKETS=rivet` 在启动时建桶，不需要一次性 init 容器
  - 它不校验签名，因此测试里 `testuser` / `testpass` 只是占位

五个服务都带容器内 healthcheck，`pnpm run e2e:servers` 用 `up --wait` 等它们真正就绪。端口是 docker-proxy 转发的：
容器里服务没起来时外部端口也能连上，所以不要用「端口能连」判断就绪（SFTP 集成测试曾因此在握手阶段报
`Connection lost before handshake`）。

Docker 不在本机时（例如服务跑在同一局域网的另一台 Debian 机器上），把 `e2e/servers` 目录拷过去执行
`docker compose up -d --wait`，再用 `RIVET_E2E_HOST` 指向它；默认仍是 `127.0.0.1`，2222/2223/8080/1445/9000 需要能从测试机访问。

```powershell
$env:RIVET_E2E_HOST = '10.1.1.188'
pnpm run test:e2e
```

换个已带 sshd 的机器时，用 `RIVET_E2E_SHELL_PORT` / `RIVET_E2E_SHELL_USER` / `RIVET_E2E_SHELL_PASSWORD` 覆盖终端用的端口与账号。

The first SFTP connect shows the host-key confirmation; the test clicks `host-key-confirm`.
写操作相关的用例会先在 UI 里进入 `upload/`，因为 atmoz/sftp 的 chroot 根目录不允许创建条目。
