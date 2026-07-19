"""POMOS 模块通用工具（跨模块复用）。

所有落地模块统一 import 本文件，提供：
- ``WEAK_THRESHOLD``：薄弱维阈值（twin 某维 < 0.5 视为薄弱）
- ``_lang(ctx)``：语言判定，优先 ``ctx["lang"]``，否则 ``settings.coach_language``，统一返回 ``"zh"``/``"en"``
- ``safe_twin(ctx)``：从 ctx 安全提取九维画像（float 归一，缺维补 0）
- ``pick(zh, en, ctx)``：按语言返回 zh 或 en 文本

设计原则（与 m08/m10 一致）：
- 防御式：所有函数对 ``None`` / 缺字段 ctx 均不抛异常，回退默认值。
- 复用 ``app.modules.assessment_engine.NINE_DIMS``（不重定义）。
- 日志统一命名 ``pomos.module.common``。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.config import settings
from app.modules.assessment_engine import NINE_DIMS

logger = logging.getLogger("pomos.module.common")

# 薄弱维阈值：twin 某维低于此值视为薄弱
WEAK_THRESHOLD: float = 0.5

# 语言白名单
_LANGS = ("zh", "en")


def _lang(ctx: Optional[Dict[str, Any]]) -> str:
    """返回当前语言 ``"zh"`` 或 ``"en"``。

    优先级：``ctx["lang"]`` 显式指定 > ``settings.coach_language`` > 默认 ``"zh"``。
    任何异常输入均安全回退为 ``"zh"``。
    """
    try:
        if isinstance(ctx, dict) and ctx.get("lang") in _LANGS:
            return ctx["lang"]  # type: ignore[return-value]
        lang = (settings.coach_language or "zh").lower()
        return "en" if lang == "en" else "zh"
    except Exception:
        return "zh"


def safe_twin(ctx: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """从 ctx 安全提取九维画像。

    来源：``ctx["twin"]`` 或 ``ctx["student_ctx"]["twin"]``；缺失时回退全 0 默认。
    每个维度经 ``float`` 归一（``None`` / ``"0"`` 等异常值回退 0.0），缺维补 0。
    """
    try:
        if not isinstance(ctx, dict):
            return {d: 0.0 for d in NINE_DIMS}
        raw = ctx.get("twin")
        if not isinstance(raw, dict):
            sc = ctx.get("student_ctx")
            raw = sc.get("twin") if isinstance(sc, dict) else None
        if not isinstance(raw, dict):
            raw = {}
        return {d: float(raw.get(d, 0.0) or 0.0) for d in NINE_DIMS}
    except Exception:
        return {d: 0.0 for d in NINE_DIMS}


def pick(zh: str, en: str, ctx: Optional[Dict[str, Any]]) -> str:
    """按 ``_lang(ctx)`` 返回 zh 或 en 文本。"""
    try:
        return en if _lang(ctx) == "en" else zh
    except Exception:
        return zh
