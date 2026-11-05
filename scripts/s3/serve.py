#!/usr/bin/env python3
"""Rivet 手动 S3 测试服务（moto）。

不是自动化测试的一部分：起一个 S3 兼容端点，给 app 的 S3 页面手工点。
CI 与 E2E 用 e2e/servers 里的 s3mock；这个脚本解决的是「本机没装 Docker、
但想点一下 UI」的场景，语义只保证基本 CRUD 与分片。

首次使用：

    python -m venv .venv-s3
    .venv-s3\\Scripts\\activate          # macOS / Linux: source .venv-s3/bin/activate
    pip install -r scripts/s3/requirements.txt

日常使用（默认 http://127.0.0.1:9000，桶 rivet，寻址方式 path-style）：

    python scripts/s3/serve.py

app 里填：协议 S3，scheme=http，host=127.0.0.1，port=9000，
桶=rivet，区域=us-east-1，Access Key ID / Secret 随便填（moto 不校验签名）。

注意：moto 的分页、错误码与真实 S3 有出入，不要用它判断行为是否正确。
"""

from __future__ import annotations

import argparse
import sys
import threading
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

try:
    from moto.server import ThreadedMotoServer
except ImportError as error:
    raise SystemExit(
        f"缺少依赖 {error.name}，先执行：\n  pip install -r scripts/s3/requirements.txt"
    ) from error

SEED_TEXT_FILES: tuple[tuple[str, str], ...] = (
    ("readme.txt", "Rivet 手动测试桶。\n"),
    ("hello world.txt", "文件名里有空格。\n"),
    ("100% 完成.txt", "百分号 + 中文 + 空格。\n"),
    ("a+b.txt", "加号不能被当成空格。\n"),
    ("#hash.txt", "井号必须被编码。\n"),
    ("empty.txt", ""),
)

SEED_DIRS: tuple[str, ...] = ("空目录", "docs/2024")

BIG_FILE_NAME = "big-9mb.bin"
BIG_FILE_SIZE = 9 * 1024 * 1024


def ensure_utf8_output() -> None:
    """Windows 下重定向到文件时默认走 GBK，横幅里的中文会变乱码。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def put_object(endpoint: str, bucket: str, key: str, body: bytes) -> None:
    # key 里有中文/空格/井号，必须逐段编码，否则 request line 只能是 ASCII。
    target = f"{endpoint}/{bucket}/{quote(key, safe='/')}"
    request = Request(target, data=body, method="PUT")
    request.add_header("Content-Type", "application/octet-stream")
    with urlopen(request, timeout=10) as response:
        response.read()


def create_bucket(endpoint: str, bucket: str) -> None:
    request = Request(f"{endpoint}/{bucket}", data=b"", method="PUT")
    try:
        with urlopen(request, timeout=10) as response:
            response.read()
    except URLError as error:
        raise SystemExit(f"创建桶 {bucket} 失败：{error}") from error


def put_directory_marker(endpoint: str, bucket: str, prefix: str) -> None:
    # S3 没有目录，空目录靠零字节的 `<prefix>/` 标记存在。
    put_object(endpoint, bucket, f"{prefix}/", b"")


def seed_bucket(endpoint: str, bucket: str) -> int:
    count = 0
    for directory in SEED_DIRS:
        put_directory_marker(endpoint, bucket, directory)
        count += 1

    for name, text in SEED_TEXT_FILES:
        put_object(endpoint, bucket, name, text.encode("utf-8"))
        count += 1

    put_object(endpoint, bucket, BIG_FILE_NAME, b"\x07" * BIG_FILE_SIZE)
    count += 1
    return count


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="serve.py",
        description="Rivet 手动 S3 测试服务（moto）",
    )
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    parser.add_argument("--port", type=int, default=9000, help="监听端口，默认 9000")
    parser.add_argument("--bucket", default="rivet", help="桶名，默认 rivet")
    parser.add_argument(
        "--no-seed",
        dest="seed",
        action="store_false",
        help="只建空桶，不写入样例对象",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    ensure_utf8_output()
    args = parse_args(argv)

    server = ThreadedMotoServer(ip_address=args.host, port=args.port, verbose=False)
    server.start()

    endpoint = f"http://{args.host}:{args.port}"
    try:
        create_bucket(endpoint, args.bucket)
        seeded = seed_bucket(endpoint, args.bucket) if args.seed else 0
    except Exception:
        server.stop()
        raise

    print(
        "\n".join(
            [
                "",
                "Rivet 手动 S3 测试服务已启动（Ctrl+C 停止）",
                "",
                f"  地址     {endpoint}",
                f"  桶       {args.bucket}",
                f"  样例     {f'{seeded} 个对象' if seeded else '未写入（--no-seed）'}",
                "",
                "  应用里填：协议 S3，scheme=http，区域 us-east-1，勾选 path-style",
                "           Access Key ID / Secret 随便填（moto 不校验签名）",
                "",
            ]
        )
    )

    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.stop()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
