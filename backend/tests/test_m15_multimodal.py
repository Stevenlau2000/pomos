"""m15 多模态引擎单测：公式 LaTeX 本地校验 + 图片类型分类 + 防御式（纯函数 + 集成）。

不依赖 fixture，直接 import 模块函数离线运行。零新依赖。
"""
import pytest

from app.config import settings
from app.modules.m15_multimodal import (
    MultimodalModule,
    _classify_image,
    _detect_input_type,
    _validate_latex,
)


def _mk_mod() -> MultimodalModule:
    return MultimodalModule()


# ---------------- _detect_input_type 分派 ----------------
def test_detect_formula_marker():
    assert _detect_input_type({"message": "帮我写个公式"}) == "formula"
    assert _detect_input_type({"formula": r"\frac{a}{b}"}) == "formula"


def test_detect_image_marker():
    assert _detect_input_type({"message": "这是一张受力分析图"}) == "image"
    assert _detect_input_type({"image": {"filename": "x.png"}}) == "image"


def test_detect_text_fallback():
    assert _detect_input_type({"message": "牛顿第二定律是什么"}) == "text"
    assert _detect_input_type({}) == "text"


# ---------------- _validate_latex：正常公式 ----------------
def test_validate_latex_valid():
    res = _validate_latex(r"\frac{a}{b}+\sqrt{x}", {"lang": "zh"})
    assert res["valid"] is True
    assert isinstance(res["errors"], list) and len(res["errors"]) == 0
    assert res["normalized"] != ""
    assert r"\frac{a}{b}+\sqrt{x}" in res["normalized"]


def test_validate_latex_valid_env_and_escaped():
    # 环境闭合 + 转义括号 + 向量命令，应合法
    res = _validate_latex(r"\vec{F}=\left\{m\vec{a}\right\}", {"lang": "zh"})
    assert res["valid"] is True


# ---------------- _validate_latex：异常公式 ----------------
def test_validate_latex_unclosed_bracket():
    res = _validate_latex(r"\frac{a}{b", {"lang": "zh"})
    assert res["valid"] is False
    assert len(res["errors"]) > 0
    assert any("未闭合" in e or "Unclosed" in e for e in res["errors"])


def test_validate_latex_mismatched_bracket():
    res = _validate_latex(r"(a]", {"lang": "zh"})
    assert res["valid"] is False
    assert len(res["errors"]) > 0


def test_validate_latex_env_mismatch():
    res = _validate_latex(r"\begin{matrix} a \end{cases}", {"lang": "zh"})
    assert res["valid"] is False
    assert len(res["errors"]) > 0


def test_validate_latex_empty():
    res = _validate_latex("", {"lang": "zh"})
    assert res["valid"] is False
    assert len(res["errors"]) > 0


# ---------------- _classify_image：分类 ----------------
def test_classify_force():
    res = _classify_image({"message": "画出物体的受力分析图", "image_meta": {"filename": "force.png"}})
    assert res["needs_ocr"] is True
    assert "受力" in res["category"] or "Force" in res["category"]
    assert 0.0 < res["confidence"] <= 1.0
    assert isinstance(res["hints"], list) and len(res["hints"]) > 0


def test_classify_unknown():
    res = _classify_image({"message": "x", "image_meta": {"filename": "weird.bin"}})
    assert res["category"] in ("未识别图类", "Unrecognized image type")
    assert res["confidence"] == 0.0
    assert res["needs_ocr"] is True


# ---------------- 集成：m15.run(ctx) 标准返回结构 ----------------
def test_run_formula_branch():
    mod = _mk_mod()
    ctx = {"student_id": "s1", "formula": r"\frac{a}{b}+\sqrt{x}"}
    res = mod.run(ctx)
    assert res["module"] == "m15_multimodal"
    assert res["action"] == "validate_formula"
    out = res["output"]
    assert out["modalities"] == ["formula", "text"]
    assert out["external_required"] is False
    assert out["latex_validation"]["valid"] is True
    assert out["latex_validation"]["normalized"] != ""
    assert res["next"] == "m07_physics_thinking"


def test_run_formula_invalid_branch():
    mod = _mk_mod()
    ctx = {"student_id": "s1", "formula": r"\frac{a}{b"}
    res = mod.run(ctx)
    assert res["action"] == "validate_formula"
    assert res["output"]["external_required"] is False
    assert res["output"]["latex_validation"]["valid"] is False
    assert len(res["output"]["latex_validation"]["errors"]) > 0


def test_run_image_branch():
    mod = _mk_mod()
    ctx = {"student_id": "s1", "message": "这是一张受力分析图", "image": {"filename": "force.png"}}
    res = mod.run(ctx)
    assert res["action"] == "classify_image"
    out = res["output"]
    assert out["external_required"] is True
    assert out["image_classification"]["category"] != ""
    assert out["image_classification"]["needs_ocr"] is True
    assert res["next"] == "external_multimodal_required"


def test_run_text_branch():
    mod = _mk_mod()
    ctx = {"student_id": "s1", "message": "讲讲动能定理"}
    res = mod.run(ctx)
    assert res["action"] == "parse_modality"
    out = res["output"]
    assert out["modalities"] == ["text"]
    assert out["external_required"] is False
    assert res["next"] == "m01_identity"


# ---------------- 防御式：空 ctx / None 不抛 ----------------
def test_run_defensive_empty_ctx():
    mod = _mk_mod()
    res = mod.run({})
    assert isinstance(res, dict)
    assert isinstance(res["output"], dict)
    assert "modalities" in res["output"]
    assert res["module"] == "m15_multimodal"


def test_run_defensive_none_ctx():
    mod = _mk_mod()
    res = mod.run(None)  # type: ignore[arg-type]
    assert isinstance(res, dict)
    assert "output" in res
    assert res["module"] == "m15_multimodal"


# ---------------- 双语：settings.coach_language="en" ----------------
def test_run_bilingual_en():
    prev = settings.coach_language
    settings.coach_language = "en"
    try:
        mod = _mk_mod()
        # 图片分支英文分类标签
        res = mod.run({"message": "受力分析图", "image": {"filename": "force.png"}})
        assert "Force analysis diagram" in res["output"]["image_classification"]["category"]
        # 公式分支英文错误说明（故意给未闭合公式）
        res2 = mod.run({"formula": r"\frac{a}{b"})
        err0 = res2["output"]["latex_validation"]["errors"][0]
        assert "Unclosed" in err0
    finally:
        settings.coach_language = prev
