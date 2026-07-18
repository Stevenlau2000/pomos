"""安全增强（技术债 ③）回归测试：SSRF 防护 + Bearer 认证。

- assert_ssrf_safe：阻断内网 / 回环 / 链路本地 / 保留 / 组播，放行公网。
- verify_token：未配置 POMOS_API_TOKEN 时整体放行；配置后要求正确 Bearer，否则 401。

运行：cd backend && .venv/bin/python3 -m pytest tests/test_security.py -q
"""
import asyncio

import pytest
from fastapi import HTTPException, Request

from app.config import validate_settings
from app.security import assert_ssrf_safe, verify_token


def _make_request(headers=None):
    """用最小 ASGI scope 构造 FastAPI Request（仅用于依赖注入测试）。"""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": [
            (k.lower().encode(), v.encode())
            for k, v in (headers or {}).items()
        ],
    }
    return Request(scope)


# ---------------------------------------------------------------- SSRF 防护
def test_ssrf_blocks_link_local():
    with pytest.raises(ValueError):
        assert_ssrf_safe("http://169.254.169.254/")


def test_ssrf_blocks_loopback():
    with pytest.raises(ValueError):
        assert_ssrf_safe("http://127.0.0.1/")


def test_ssrf_blocks_private():
    with pytest.raises(ValueError):
        assert_ssrf_safe("http://10.0.0.5/")


def test_ssrf_allows_public_ip():
    # IP 字面量（离线可解析、确定性的公网地址）应放行
    assert_ssrf_safe("https://1.1.1.1/")


def test_ssrf_allows_public_domain():
    # 域名形式（依赖 DNS；沙箱无网络时跳过，非源码问题）
    try:
        assert_ssrf_safe("https://api.openai.com/")
    except ValueError as e:
        if "cannot resolve host" in str(e):
            pytest.skip("sandbox 无 DNS，跳过域名解析用例")
        raise


# ---------------------------------------------------------------- Bearer 认证
def test_verify_token_disabled_when_no_env(monkeypatch):
    monkeypatch.delenv("POMOS_API_TOKEN", raising=False)
    req = _make_request({})
    # 未配置 token → 认证关闭，直接放行（返回空串标记）
    assert asyncio.run(verify_token(req)) == ""


def test_verify_token_missing_bearer(monkeypatch):
    monkeypatch.setenv("POMOS_API_TOKEN", "secret")
    req = _make_request({})  # 无 Authorization 头
    with pytest.raises(HTTPException) as exc:
        asyncio.run(verify_token(req))
    assert exc.value.status_code == 401


def test_verify_token_wrong_token(monkeypatch):
    monkeypatch.setenv("POMOS_API_TOKEN", "secret")
    req = _make_request({"Authorization": "Bearer wrong"})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(verify_token(req))
    assert exc.value.status_code == 401


def test_verify_token_correct(monkeypatch):
    monkeypatch.setenv("POMOS_API_TOKEN", "secret")
    req = _make_request({"Authorization": "Bearer secret"})
    assert asyncio.run(verify_token(req)) == "secret"


# ---------------------------------------------------------------- config 集成（③：validate_settings 调 assert_ssrf_safe）
def test_validate_settings_rejects_ssrf_loopback():
    errs = validate_settings({"llm_base_url": "http://127.0.0.1/"})
    assert any("SSRF" in e for e in errs)


def test_validate_settings_rejects_ssrf_link_local():
    errs = validate_settings({"llm_base_url": "http://169.254.169.254/"})
    assert any("SSRF" in e for e in errs)


def test_validate_settings_rejects_ssrf_private():
    errs = validate_settings({"llm_base_url": "http://10.0.0.5/"})
    assert any("SSRF" in e for e in errs)


def test_validate_settings_allows_public_ip():
    # 公网 IP 字面量（离线可解析、确定性）应放行
    errs = validate_settings({"llm_base_url": "https://1.1.1.1/"})
    assert not any("SSRF" in e for e in errs)


def test_validate_settings_allows_public_domain():
    # 域名形式（依赖 DNS；沙箱无网络时跳过，非源码问题）
    errs = validate_settings({"llm_base_url": "https://api.openai.com/"})
    ssrf_errs = [e for e in errs if "SSRF" in e]
    if ssrf_errs and any("cannot resolve host" in e for e in ssrf_errs):
        pytest.skip("sandbox 无 DNS，跳过域名解析用例")
    assert not ssrf_errs
