"""m01 身份系统单测：service_boundary 存在 + 双语键值（纯函数 + 集成）。"""
from app.modules.m01_identity import IdentityModule, build_identity
from app.config import settings


def test_output_has_service_boundary():
    mod = IdentityModule()
    res = mod.run({"student_id": "s1", "message": "你是谁"})
    assert "service_boundary" in res["output"]
    assert isinstance(res["output"]["service_boundary"], list)
    assert len(res["output"]["service_boundary"]) >= 1
    assert res["output"]["student_id"] == "s1"


def test_build_identity_keys():
    ident = build_identity("zh")
    assert set(ident.keys()) >= {"persona", "tone", "scope", "service_boundary"}


def test_run_en_returns_english():
    mod = IdentityModule()
    prev = settings.coach_language
    settings.coach_language = "en"
    try:
        res = mod.run({})  # 空 ctx，lang 走 settings
        out = res["output"]
        # 英文键值：persona 含 Coach，service_boundary 用英文 CAN/CANNOT
        assert "Coach" in out["persona"]
        assert any("CANNOT" in s for s in out["service_boundary"])
    finally:
        settings.coach_language = prev


def test_run_defensive_no_ctx():
    mod = IdentityModule()
    res = mod.run({})
    assert res["module"] == "m01_identity"
    assert "service_boundary" in res["output"]
