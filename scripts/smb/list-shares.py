#!/usr/bin/env python3
"""列出 SMB 服务器上的共享名（Impacket）。

用于不知道共享名、或服务端只给出主机和端口的情况。

首次使用：

    python -m venv .venv-smb
    .venv-smb\\Scripts\\activate
    pip install -r scripts/smb/requirements.txt

用法：

    python scripts/smb/list-shares.py <host> --user testuser --password testpass

默认强制 SMB2.1 协商；如果服务端只支持 SMB3，可加 `--dialect 3.1.1`。
"""

from __future__ import annotations

import argparse
import getpass
import sys

try:
    from impacket.smbconnection import (
        SMB2_DIALECT_21,
        SMB2_DIALECT_30,
        SMB2_DIALECT_311,
        SMBConnection,
    )
except ImportError as error:
    raise SystemExit(
        f"缺少依赖 {error.name}，先执行：\n  pip install -r scripts/smb/requirements.txt"
    ) from error

DIALECTS = {
    "2.1": SMB2_DIALECT_21,
    "3.0": SMB2_DIALECT_30,
    "3.1.1": SMB2_DIALECT_311,
}


def text_of(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace").rstrip("\x00")
    return str(value).rstrip("\x00")


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="list-shares.py",
        description="列出 SMB 服务器上的共享名（Impacket）",
    )
    parser.add_argument("host", help="服务器地址或主机名")
    parser.add_argument("--port", type=int, default=445, help="SMB 端口，默认 445")
    parser.add_argument("--user", required=True, help="用户名")
    parser.add_argument(
        "--password",
        default=None,
        help="密码；省略时交互输入，避免把密码写进命令历史",
    )
    parser.add_argument("--domain", default="", help="NTLM 域；工作组可留空")
    parser.add_argument(
        "--dialect",
        choices=tuple(DIALECTS),
        default="2.1",
        help="首选 SMB2 方言，默认 2.1",
    )
    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error("--port 必须在 0-65535 之间")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    password = args.password if args.password is not None else getpass.getpass("Password: ")

    connection = SMBConnection(
        args.host,
        args.host,
        sess_port=args.port,
        preferredDialect=DIALECTS[args.dialect],
    )
    try:
        connection.login(args.user, password, args.domain)
        shares = connection.listShares()
    except Exception as error:
        print(f"枚举共享失败：{error}", file=sys.stderr)
        print("如果服务端禁止 NetrShareEnum，请在服务器端查看共享名。", file=sys.stderr)
        return 1
    finally:
        try:
            connection.logoff()
        except Exception:
            pass

    if not shares:
        print("没有枚举到共享（可能是权限不足或服务端禁止共享枚举）。")
        return 0

    print("共享名\t类型\t备注")
    for share in shares:
        name = text_of(share["shi1_netname"])
        remark = text_of(share["shi1_remark"])
        share_type = text_of(share["shi1_type"])
        print(f"{name}\t{share_type}\t{remark}")

    print("\n应用里“共享名”填上面的名字（忽略 IPC$ 这类系统共享）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
