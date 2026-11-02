#!/usr/bin/env python3
"""Rivet 手动 WebDAV 测试服务（WsgiDAV）。

不是自动化测试的一部分：起一个真实 DAV 服务，给 app 的 WebDAV 页面手工点。
Docker 里的 bytemark/webdav 只覆盖 Basic + 明文 HTTP + 可写根；
这个脚本把 README 承诺过、但平时点不到的分支都做成开关：Digest、自签 HTTPS、basePath 前缀、只读目录。

首次使用：

    python -m venv .venv-dav
    .venv-dav\\Scripts\\activate          # macOS / Linux: source .venv-dav/bin/activate
    pip install -r scripts/dav/requirements.txt

日常使用（默认 http://127.0.0.1:8080，Basic，testuser / testpass）：

    python scripts/dav/serve.py

点各自的分支：

    python scripts/dav/serve.py --auth digest            # 401 Digest challenge + 重试
    python scripts/dav/serve.py --https                  # 自签证书，app 里要取消勾选“拒绝未授权证书”
    python scripts/dav/serve.py --base-path /dav --port 8081
    python scripts/dav/serve.py --readonly               # 写操作应报 PERMISSION_DENIED
    python scripts/dav/serve.py --port 0                 # 随机端口，避开 Docker 占用的 8080

根目录默认是系统临时目录下的 rivet-dav-root 沙箱，起停不会弄脏仓库：启动时从系统临时目录
拷一批真实文件进去（真实名字、真实大小、真实内容），再补几个边界文件名；
--root 可指到任意目录。
"""

from __future__ import annotations

import argparse
import datetime
import ipaddress
import shutil
import sys
import tempfile
from pathlib import Path

try:
    from cheroot import wsgi
    from cheroot.ssl.builtin import BuiltinSSLAdapter
    from wsgidav.fs_dav_provider import FilesystemProvider
    from wsgidav.wsgidav_app import WsgiDAVApp
except ImportError as error:
    raise SystemExit(
        f"缺少依赖 {error.name}，先执行：\n  pip install -r scripts/dav/requirements.txt"
    ) from error

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

SAMPLE_FILE_LIMIT = 20
SAMPLE_FILE_MIN_BYTES = 4 * 1024
SAMPLE_FILE_MAX_BYTES = 8 * 1024 * 1024
SAMPLE_TOTAL_BYTES = 40 * 1024 * 1024


def copy_temp_samples(root: Path, source: Path) -> list[str]:
    """把系统临时目录里的真实文件拷进沙箱：真实名字、真实大小、真实内容。

    只取顶层普通文件，按大小从大到小挑，避开正在被别的进程占用的、或大到没必要的。
    """
    candidates: list[tuple[int, Path]] = []
    try:
        for entry in source.iterdir():
            try:
                if entry.is_symlink() or not entry.is_file():
                    continue
                size = entry.stat().st_size
            except OSError:
                continue
            if SAMPLE_FILE_MIN_BYTES <= size <= SAMPLE_FILE_MAX_BYTES:
                candidates.append((size, entry))
    except OSError:
        return []

    picked: list[str] = []
    total = 0
    for size, entry in sorted(candidates, key=lambda item: item[0], reverse=True):
        if len(picked) >= SAMPLE_FILE_LIMIT or total + size > SAMPLE_TOTAL_BYTES:
            break
        target = root / entry.name
        if not target.exists():
            try:
                shutil.copy2(entry, target)
            except OSError:
                continue
        picked.append(entry.name)
        total += size

    return picked


def seed_root(root: Path, source: Path) -> list[str]:
    """准备样例：真实临时文件副本 + 边界文件名，只补缺失项，不覆盖手工改过的内容。"""
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

    return copy_temp_samples(root, source)


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="serve.py",
        description="Rivet 手动 WebDAV 测试服务（WsgiDAV）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "认证分支：--auth digest 只在第一次请求发 401 challenge。\n"
            "app 的流式 PUT 不会重试 Digest，所以先列目录再上传才会成功——这正是要手工确认的行为。"
        ),
    )
    parser.add_argument(
        "--root", default=None, help="服务根目录，默认系统临时目录下的 rivet-dav-root"
    )
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument(
        "--port", type=int, default=8080, help="监听端口，0 表示随机端口"
    )
    parser.add_argument("--user", default="testuser", help="用户名，默认 testuser")
    parser.add_argument("--password", default="testpass", help="密码，默认 testpass")
    parser.add_argument(
        "--auth",
        choices=("basic", "digest", "both", "anonymous"),
        default="basic",
        help="认证方式，默认 basic",
    )
    parser.add_argument(
        "--base-path",
        default="/",
        help="挂载前缀，例如 /dav；app 的 basePath 填同样的值",
    )
    parser.add_argument("--readonly", action="store_true", help="只读：写操作返回 403")
    parser.add_argument("--https", action="store_true", help="启用 HTTPS（自签证书）")
    parser.add_argument("--cert", default=None, help="证书路径，默认自动生成自签证书")
    parser.add_argument("--key", default=None, help="私钥路径，与 --cert 搭配")
    parser.add_argument(
        "--no-seed",
        dest="seed",
        action="store_false",
        help="不生成样例（真实临时文件副本 + 边界文件名）",
    )
    parser.add_argument(
        "--verbose", type=int, choices=range(0, 6), default=3, help="日志级别 0-5"
    )
    parser.add_argument("--threads", type=int, default=12, help="工作线程数，默认 12")

    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error("--port 必须在 0-65535 之间")
    if args.threads < 1:
        parser.error("--threads 必须大于 0")

    base = args.base_path.strip()
    if not base.startswith("/"):
        base = "/" + base
    base = base.rstrip("/")
    args.base_path = base or "/"
    return args


def default_root() -> Path:
    return Path(tempfile.gettempdir()) / "rivet-dav-root"


def ensure_utf8_output() -> None:
    """Windows 下重定向到文件时默认走 GBK，横幅和路径里的中文会变乱码。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def ensure_certificate(cert: Path, key: Path, host: str) -> None:
    if cert.is_file() and key.is_file():
        return

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except ImportError:
        raise SystemExit(
            "生成自签证书需要 cryptography：pip install cryptography\n"
            "或者用 openssl 自己生成，然后传 --cert 与 --key。"
        )

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "rivet-dav")])

    alternates = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
    ]
    try:
        alternates.append(x509.IPAddress(ipaddress.ip_address(host)))
    except ValueError:
        alternates.append(x509.DNSName(host))

    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(alternates), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(private_key, hashes.SHA256())
    )

    cert.parent.mkdir(parents=True, exist_ok=True)
    key.parent.mkdir(parents=True, exist_ok=True)
    cert.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )


def build_config(args: argparse.Namespace, root: Path) -> dict:
    provider = FilesystemProvider(str(root), readonly=args.readonly)

    config: dict = {
        "provider_mapping": {args.base_path: provider},
        "verbose": args.verbose,
        "logging": {"enable": True},
        "dir_browser": {
            "enable": True,
            "ms_sharepoint_support": False,
            "libre_office_support": False,
        },
        "lock_storage": True,
    }

    if args.auth == "anonymous":
        config["simple_dc"] = {"user_mapping": {"*": True}}
        config["http_authenticator"] = {
            "accept_basic": True,
            "accept_digest": True,
            "default_to_digest": False,
        }
        return config

    config["simple_dc"] = {
        "user_mapping": {"*": {args.user: {"password": args.password}}}
    }
    config["http_authenticator"] = {
        "accept_basic": args.auth in ("basic", "both"),
        "accept_digest": args.auth in ("digest", "both"),
        "default_to_digest": args.auth in ("digest", "both"),
    }
    return config


def describe_auth(args: argparse.Namespace) -> str:
    return {
        "basic": "Basic",
        "digest": "Digest（Basic 已关闭）",
        "both": "Basic + Digest（401 challenge 给 Digest）",
        "anonymous": "匿名（账号密码随便填）",
    }[args.auth]


def display_host(host: str) -> str:
    return "127.0.0.1" if host in ("0.0.0.0", "::") else host


def describe_samples(seeded: bool, copied: list[str]) -> str:
    if not seeded:
        return "未生成（--no-seed，或根目录就是系统临时目录）"
    if copied:
        return f"{len(copied)} 个真实临时文件 + 内建边界名"
    return "仅内建边界名（临时目录里没找到可用文件）"


def print_banner(
    args: argparse.Namespace,
    root: Path,
    scheme: str,
    port: int,
    certificate: Path | None,
    seeded: bool,
    copied: list[str],
) -> None:
    host = display_host(args.host)
    prefix = "" if args.base_path == "/" else args.base_path
    url = f"{scheme}://{host}:{port}{prefix}/"
    account = (
        "无需认证" if args.auth == "anonymous" else f"{args.user} / {args.password}"
    )

    lines = [
        "",
        "Rivet 手动 WebDAV 测试服务已启动（Ctrl+C 停止）",
        "",
        f"  地址     {url}",
        f"  账号     {account}",
        f"  认证     {describe_auth(args)}",
        f"  权限     {'只读（写操作 403）' if args.readonly else '可写'}",
        f"  根目录   {root}",
        f"  样例     {describe_samples(seeded, copied)}",
        f"  监听     {args.host}:{port}",
    ]
    if certificate is not None:
        lines.append(f"  证书     {certificate}")
    lines += [
        "",
        "  应用里填：协议 WebDAV，scheme=" + scheme,
        f"           host={host}  port={port}  basePath={'留空' if prefix == '' else prefix}",
    ]
    if scheme == "https":
        lines.append(
            "           HTTPS 下默认会拒绝自签证书：取消勾选“拒绝未授权证书”并确认警告。"
        )
    lines.append("")
    print("\n".join(lines))


def build_server(
    args: argparse.Namespace, app: WsgiDAVApp
) -> tuple[wsgi.Server, Path | None]:
    server = wsgi.Server(
        (args.host, args.port),
        app,
        numthreads=args.threads,
        server_name="RivetDav",
        timeout=120,
    )

    certificate: Path | None = None
    if args.https:
        cert = (
            Path(args.cert)
            if args.cert
            else Path(tempfile.gettempdir()) / "rivet-dav-cert" / "cert.pem"
        )
        key = Path(args.key) if args.key else cert.with_name("key.pem")
        ensure_certificate(cert, key, args.host)
        server.ssl_adapter = BuiltinSSLAdapter(str(cert), str(key))
        certificate = cert

    return server, certificate


def main(argv: list[str] | None = None) -> int:
    ensure_utf8_output()
    args = parse_args(argv)

    root = (
        Path(args.root).expanduser().resolve()
        if args.root
        else default_root().resolve()
    )
    root.mkdir(parents=True, exist_ok=True)

    source = Path(tempfile.gettempdir()).resolve()
    seeded = args.seed and root != source
    copied = seed_root(root, source) if seeded else []

    app = WsgiDAVApp(build_config(args, root))
    server, certificate = build_server(args, app)

    try:
        server.prepare()
    except OSError as error:
        print(f"无法监听 {args.host}:{args.port}：{error}", file=sys.stderr)
        print("端口被占用时试试 --port 0（随机端口）或 --port 8081。", file=sys.stderr)
        return 1

    port = server.bind_addr[1]
    print_banner(
        args, root, "https" if args.https else "http", port, certificate, seeded, copied
    )

    try:
        server.serve()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.stop()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
