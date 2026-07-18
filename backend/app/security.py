"""安全增强（技术债 ③）：可选共享密钥认证 + SSRF 防护。

认证策略（team-lead 决策）：
- 统一环境变量门控 `POMOS_API_TOKEN`。
- 未设置 → 认证整体关闭（本地 / 离线 / 静态前端默认无 token，不受影响）。
- 已设置 → 所有路由（含 `PUT /api/settings`）统一要求
  `Authorization: Bearer <token>`，缺失 / 错误返回 401。
"""
import os
import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import Request, Depends, HTTPException


def _token() -> str:
    """读取并清洗环境变量中的共享密钥。"""
    return os.environ.get("POMOS_API_TOKEN", "").strip()


async def verify_token(req: Request) -> str:
    """FastAPI 依赖：校验 Bearer 令牌。

    - 未配置 token → 认证关闭，直接放行（返回空串标记）。
    - 已配置 token → 要求请求头携带正确的 Bearer 令牌，否则 401。
    """
    tok = _token()
    if not tok:
        return ""
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if auth[len("Bearer "):].strip() != tok:
        raise HTTPException(status_code=401, detail="Invalid token")
    return tok


def assert_ssrf_safe(url: str) -> None:
    """校验 URL 是否可被安全访问，阻断 SSRF。

    - 仅允许 http / https 协议；
    - 解析域名对应的所有 IP，拒绝内网 / 回环 / 链路本地 / 保留 / 组播地址。

    不合规时抛出 ValueError，由调用方转换为 400 或对应错误。
    """
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        raise ValueError("only http(s) allowed")
    host = p.hostname or ""
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        raise ValueError(f"cannot resolve host: {host}")
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
        ):
            raise ValueError(f"blocked address: {ip}")
