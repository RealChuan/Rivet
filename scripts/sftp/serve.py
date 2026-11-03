#!/usr/bin/env python3
"""Rivet 手动 SFTP 测试服务（Paramiko）。

不是自动化测试的一部分：起一个真实 SFTP 服务，给 app 的 SFTP 页面手工点。
Docker 里的 atmoz/sftp 只覆盖密码认证 + chroot；
这个脚本把 README 承诺过、但平时点不到的分支都做成开关：
私钥认证、只读目录、主机密钥首次确认与变更。

首次使用：

    python -m venv .venv-sftp
    .venv-sftp\\Scripts\\activate          # macOS / Linux: source .venv-sftp/bin/activate
    pip install -r scripts/sftp/requirements.txt

日常使用（默认 127.0.0.1:2222，密码认证，testuser / testpass）：

    python scripts/sftp/serve.py

点各自的分支：

    python scripts/sftp/serve.py --auth publickey        # 任意公钥都能登录
    python scripts/sftp/serve.py --emit-client-key       # 顺带生成一把客户端私钥
    python scripts/sftp/serve.py --readonly              # 写操作应报 PERMISSION_DENIED
    python scripts/sftp/serve.py --rotate-host-key       # 主机密钥变更，app 应弹确认
    python scripts/sftp/serve.py --port 0                # 随机端口，避开 Docker 占用的 2222

根目录默认是系统临时目录下的 rivet-sftp-root 沙箱，起停不会弄脏仓库；
启动时补一批边界文件名、空文件、深层目录和一个 4MB 文件；--root 可指到任意目录。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import logging
import os
import socketserver
import stat
import sys
import tempfile
import time
from pathlib import Path

try:
    from paramiko import (
        AUTH_FAILED,
        AUTH_SUCCESSFUL,
        OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED,
        OPEN_SUCCEEDED,
        RSAKey,
        ServerInterface,
        SFTPAttributes,
        SFTPHandle,
        SFTP_FAILURE,
        SFTP_NO_SUCH_FILE,
        SFTP_OK,
        SFTP_PERMISSION_DENIED,
        SFTPServer,
        SFTPServerInterface,
        SSHException,
        Transport,
    )
except ImportError as error:
    raise SystemExit(
        f"缺少依赖 {error.name}，先执行：\n  pip install -r scripts/sftp/requirements.txt"
    ) from error

HOST_KEY_BITS = 3072

SEED_DIRS: tuple[tuple[str, ...], ...] = (
    ("空目录",),
    ("文档 资料", "2024 年", "深层"),
)

SEED_TEXT_FILES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("readme.txt",), "Rivet 手动测试根目录。\n"),
    (("hello world.txt",), "文件名里有空格。\n"),
    (("100% 完成.txt",), "百分号 + 中文 + 空格。\n"),
    (("a+b.txt",), "加号不能被当成空格。\n"),
    (("#hash.txt",), "井号必须被编码成 %23。\n"),
    ((".hidden.txt",), "隐藏文件。\n"),
    (("empty.txt",), ""),
    (("文档 资料", "设计 说明.md"), "# 设计说明\n"),
    (("文档 资料", "2024 年", "深层", "deep.txt"), "深层目录里的文件。\n"),
)

BIG_FILE_NAME = "big-4mb.bin"
BIG_FILE_SIZE = 4 * 1024 * 1024


def ensure_utf8_output() -> None:
    """Windows 下重定向到文件时默认走 GBK，中文路径会变乱码。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def default_root() -> Path:
    return Path(tempfile.gettempdir()) / "rivet-sftp-root"


def default_host_key() -> Path:
    return Path(tempfile.gettempdir()) / "rivet-sftp-host-key" / "host_rsa"


def default_client_key_dir() -> Path:
    return Path(tempfile.gettempdir()) / "rivet-sftp-client-keys"


def seed_root(root: Path) -> None:
    """准备样例：边界文件名 + 深层目录 + 一个 4MB 文件，只补缺失项。"""
    for parts in SEED_DIRS:
        root.joinpath(*parts).mkdir(parents=True, exist_ok=True)

    for parts, text in SEED_TEXT_FILES:
        target = root.joinpath(*parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(text, encoding="utf-8")

    big = root / BIG_FILE_NAME
    if not big.exists():
        pattern = bytes(range(256))
        big.write_bytes(pattern * (BIG_FILE_SIZE // len(pattern)))


def ensure_host_key(path: Path, rotate: bool) -> RSAKey:
    if path.is_file() and not rotate:
        return RSAKey.from_private_key_file(str(path))

    path.parent.mkdir(parents=True, exist_ok=True)
    key = RSAKey.generate(HOST_KEY_BITS)
    key.write_private_key_file(str(path))
    return key


def emit_client_key(passphrase: str | None) -> Path:
    """生成一把客户端 RSA 私钥，供 app 的“私钥认证”分支使用。"""
    directory = default_client_key_dir()
    directory.mkdir(parents=True, exist_ok=True)

    private = directory / "id_rsa"
    public = directory / "id_rsa.pub"

    key = RSAKey.generate(HOST_KEY_BITS)
    key.write_private_key_file(str(private), password=passphrase or None)
    public.write_text(f"{key.get_name()} {key.get_base64()} rivet-sftp\n", encoding="utf-8")
    return private


def fingerprint_of(key: RSAKey) -> str:
    digest = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode()
    return f"SHA256:{digest.rstrip('=')}"


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="serve.py",
        description="Rivet 手动 SFTP 测试服务（Paramiko）",
    )
    parser.add_argument(
        "--root", default=None, help="服务根目录，默认系统临时目录下的 rivet-sftp-root"
    )
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument(
        "--port", type=int, default=2222, help="监听端口，0 表示随机端口"
    )
    parser.add_argument("--user", default="testuser", help="用户名，默认 testuser")
    parser.add_argument("--password", default="testpass", help="密码，默认 testpass")
    parser.add_argument(
        "--auth",
        choices=("password", "publickey", "both"),
        default="password",
        help="认证方式；publickey 模式接受任意公钥，默认 password",
    )
    parser.add_argument("--readonly", action="store_true", help="只读：写操作返回权限错误")
    parser.add_argument(
        "--host-key", default=None, help="host key 路径，默认系统临时目录下 rivet-sftp-host-key/host_rsa"
    )
    parser.add_argument(
        "--rotate-host-key", action="store_true", help="重新生成 host key，用于验证主机密钥变更"
    )
    parser.add_argument(
        "--emit-client-key",
        action="store_true",
        help="生成客户端私钥（默认放在系统临时目录 rivet-sftp-client-keys）",
    )
    parser.add_argument(
        "--client-key-passphrase", default=None, help="生成的客户端私钥口令，默认无口令"
    )
    parser.add_argument(
        "--no-seed", dest="seed", action="store_false", help="不生成样例文件"
    )
    parser.add_argument(
        "--verbose", type=int, choices=range(0, 4), default=1, help="日志级别 0-3，默认 1"
    )

    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error("--port 必须在 0-65535 之间")
    return args


def describe_auth(auth: str, user: str, password: str) -> str:
    if auth == "password":
        return f"password（{user} / {password}）"
    if auth == "publickey":
        return f"publickey（{user}，接受任意公钥）"
    return f"password 或 publickey（{user} / {password}）"


def display_host(host: str) -> str:
    return "127.0.0.1" if host in ("0.0.0.0", "::") else host


def print_banner(
    args: argparse.Namespace,
    root: Path,
    port: int,
    host_key_path: Path,
    host_key: RSAKey,
    client_key: Path | None,
) -> None:
    host = display_host(args.host)
    lines = [
        "",
        "Rivet 手动 SFTP 测试服务已启动（Ctrl+C 停止）",
        "",
        f"  地址       {host}:{port}",
        f"  认证       {describe_auth(args.auth, args.user, args.password)}",
        f"  权限       {'只读（写操作被拒）' if args.readonly else '可写'}",
        f"  根目录     {root}",
        f"  主机密钥   {host_key_path}",
        f"             {host_key.get_name()}  {fingerprint_of(host_key)}",
        f"  样例       {'边界文件名 + 4MB 文件' if args.seed else '未生成（--no-seed）'}",
    ]
    if client_key is not None:
        passphrase = f"口令 {args.client_key_passphrase}" if args.client_key_passphrase else "无口令"
        lines.append(f"  客户端私钥 {client_key}（{passphrase}）")
    lines += [
        "",
        f"  应用里填：协议 SFTP，host={host} port={port}",
        "",
    ]
    print("\n".join(lines))


def map_os_error(error: OSError) -> int:
    if isinstance(error, PermissionError):
        return SFTP_PERMISSION_DENIED
    if isinstance(error, FileNotFoundError):
        return SFTP_NO_SUCH_FILE
    return SFTP_FAILURE


def resolve_path(root: Path, virtual: str) -> Path | int:
    """把 SFTP 的 POSIX 虚拟路径映射到 root 下的真实路径，拒绝越界。"""
    parts: list[str] = []
    for part in virtual.replace("\\", "/").split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return SFTP_PERMISSION_DENIED
            parts.pop()
            continue
        if "\x00" in part:
            return SFTP_PERMISSION_DENIED
        parts.append(part)
    return root.joinpath(*parts)


def open_mode(flags: int, real: Path) -> str:
    if flags & os.O_EXCL and flags & os.O_CREAT:
        return "xb"
    if flags & os.O_TRUNC:
        return "wb"
    if flags & os.O_APPEND:
        return "ab"
    if flags & os.O_CREAT and not real.exists():
        return "xb"
    if flags & (os.O_WRONLY | os.O_RDWR):
        return "r+b"
    return "rb"


class FileHandle(SFTPHandle):
    def __init__(self, fileobj, flags: int) -> None:
        super().__init__(flags)
        self.fileobj = fileobj
        self.flags = flags

    def read(self, offset: int, length: int):
        try:
            self.fileobj.seek(offset)
            return self.fileobj.read(length)
        except OSError as error:
            return map_os_error(error)

    def write(self, offset: int, data: bytes) -> int:
        try:
            if not self.flags & os.O_APPEND:
                self.fileobj.seek(offset)
            self.fileobj.write(data)
            self.fileobj.flush()
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def stat(self):
        try:
            return SFTPAttributes.from_stat(os.fstat(self.fileobj.fileno()))
        except OSError as error:
            return map_os_error(error)

    def close(self) -> None:
        try:
            self.fileobj.close()
        except OSError:
            pass


class FilesystemInterface(SFTPServerInterface):
    def __init__(self, server: ServerInterface, *args, **kwargs) -> None:
        super().__init__(server, *args, **kwargs)
        self.options = server.options

    def real_path(self, path: str) -> Path | int:
        return resolve_path(self.options.root, path)

    def list_folder(self, path: str):
        real = self.real_path(path)
        if isinstance(real, int):
            return real

        try:
            entries = []
            for entry in os.scandir(real):
                try:
                    attributes = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                entries.append(SFTPAttributes.from_stat(attributes, filename=entry.name))
            return entries
        except OSError as error:
            return map_os_error(error)

    def stat(self, path: str):
        real = self.real_path(path)
        if isinstance(real, int):
            return real
        try:
            return SFTPAttributes.from_stat(os.stat(real))
        except OSError as error:
            return map_os_error(error)

    def lstat(self, path: str):
        real = self.real_path(path)
        if isinstance(real, int):
            return real
        try:
            return SFTPAttributes.from_stat(os.lstat(real))
        except OSError as error:
            return map_os_error(error)

    def open(self, path: str, flags: int, attr: SFTPAttributes):
        real = self.real_path(path)
        if isinstance(real, int):
            return real

        wants_write = bool(
            flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
        )
        if wants_write and self.options.readonly:
            return SFTP_PERMISSION_DENIED

        try:
            fileobj = open(real, open_mode(flags, real))
        except OSError as error:
            return map_os_error(error)

        mode = getattr(attr, "st_mode", None)
        if wants_write and mode is not None:
            try:
                os.chmod(real, stat.S_IMODE(mode))
            except OSError:
                pass

        return FileHandle(fileobj, flags)

    def remove(self, path: str) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        real = self.real_path(path)
        if isinstance(real, int):
            return real
        try:
            os.remove(real)
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def rename(self, oldpath: str, newpath: str) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        old = self.real_path(oldpath)
        new = self.real_path(newpath)
        if isinstance(old, int):
            return old
        if isinstance(new, int):
            return new
        try:
            os.rename(old, new)
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def posix_rename(self, oldpath: str, newpath: str) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        old = self.real_path(oldpath)
        new = self.real_path(newpath)
        if isinstance(old, int):
            return old
        if isinstance(new, int):
            return new
        try:
            os.replace(old, new)
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def mkdir(self, path: str, attr: SFTPAttributes) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        real = self.real_path(path)
        if isinstance(real, int):
            return real

        mode = 0o755
        requested = getattr(attr, "st_mode", None)
        if requested is not None:
            mode = stat.S_IMODE(requested)

        try:
            os.mkdir(real, mode)
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def rmdir(self, path: str) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        real = self.real_path(path)
        if isinstance(real, int):
            return real
        try:
            os.rmdir(real)
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def chattr(self, path: str, attr: SFTPAttributes) -> int:
        if self.options.readonly:
            return SFTP_PERMISSION_DENIED
        real = self.real_path(path)
        if isinstance(real, int):
            return real

        try:
            mode = getattr(attr, "st_mode", None)
            if mode is not None:
                os.chmod(real, stat.S_IMODE(mode))

            uid = getattr(attr, "st_uid", None)
            gid = getattr(attr, "st_gid", None)
            if uid is not None and gid is not None and hasattr(os, "chown"):
                os.chown(real, uid, gid)

            size = getattr(attr, "st_size", None)
            if size is not None:
                with open(real, "r+b") as fileobj:
                    fileobj.truncate(size)

            atime = getattr(attr, "st_atime", None)
            mtime = getattr(attr, "st_mtime", None)
            if atime is not None or mtime is not None:
                current = os.stat(real)
                os.utime(
                    real,
                    (
                        atime if atime is not None else current.st_atime,
                        mtime if mtime is not None else current.st_mtime,
                    ),
                )
        except OSError as error:
            return map_os_error(error)
        return SFTP_OK

    def canonicalize(self, path: str):
        real = self.real_path(path)
        if isinstance(real, int):
            return real
        relative = real.relative_to(self.options.root)
        if not relative.parts:
            return "/"
        return "/" + relative.as_posix()


class AuthServer(ServerInterface):
    def __init__(self, options: argparse.Namespace) -> None:
        self.options = options

    def check_auth_password(self, username: str, password: str) -> int:
        if self.options.auth not in ("password", "both"):
            return AUTH_FAILED
        if username == self.options.user and password == self.options.password:
            return AUTH_SUCCESSFUL
        return AUTH_FAILED

    def check_auth_publickey(self, username: str, key) -> int:
        if self.options.auth not in ("publickey", "both"):
            return AUTH_FAILED
        return AUTH_SUCCESSFUL if username == self.options.user else AUTH_FAILED

    def get_allowed_auths(self, username: str) -> str:
        if self.options.auth == "password":
            return "password"
        if self.options.auth == "publickey":
            return "publickey"
        return "password,publickey"

    def check_channel_request(self, kind: str, chanid: int) -> int:
        if kind == "session":
            return OPEN_SUCCEEDED
        return OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED


class ConnectionHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        transport = Transport(self.request)
        transport.add_server_key(self.server.host_key)
        transport.set_subsystem_handler("sftp", SFTPServer, FilesystemInterface)

        try:
            transport.start_server(server=AuthServer(self.server.options))
            channel = transport.accept(20)
            if channel is None:
                return
            while transport.is_active() and not channel.closed:
                time.sleep(0.5)
        finally:
            transport.close()


class SftpServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address: tuple[str, int], options: argparse.Namespace, host_key: RSAKey) -> None:
        self.options = options
        self.host_key = host_key
        super().__init__(address, ConnectionHandler)


def main(argv: list[str] | None = None) -> int:
    ensure_utf8_output()
    args = parse_args(argv)

    root = (
        Path(args.root).expanduser().resolve()
        if args.root
        else default_root().resolve()
    )
    root.mkdir(parents=True, exist_ok=True)
    args.root = root
    if args.seed:
        seed_root(root)

    host_key_path = (
        Path(args.host_key).expanduser().resolve()
        if args.host_key
        else default_host_key().resolve()
    )
    try:
        host_key = ensure_host_key(host_key_path, args.rotate_host_key)
    except (OSError, SSHException) as error:
        print(f"无法准备 host key {host_key_path}：{error}", file=sys.stderr)
        return 1

    client_key: Path | None = None
    if args.emit_client_key:
        try:
            client_key = emit_client_key(args.client_key_passphrase)
        except (OSError, SSHException) as error:
            print(f"无法生成客户端私钥：{error}", file=sys.stderr)
            return 1

    try:
        server = SftpServer((args.host, args.port), args, host_key)
    except OSError as error:
        print(f"无法监听 {args.host}:{args.port}：{error}", file=sys.stderr)
        print("端口被占用时试试 --port 0（随机端口）或 --port 2223。", file=sys.stderr)
        return 1

    if args.verbose >= 3:
        logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(name)s: %(message)s")

    port = server.server_address[1]
    print_banner(args, root, port, host_key_path, host_key, client_key)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
