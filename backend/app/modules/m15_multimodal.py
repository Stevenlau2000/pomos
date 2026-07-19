"""POMOS 规范模块 15_Unified_Multimodal_Learning_Intelligence_Engine（Runtime 层）。

UMLIE：统一多模态学习智能——解析题目图片、手绘、公式 OCR 等。
当前为**结构化降级**实现：检测图片/公式类输入，明确返回「需外部 OCR/LLM 多模态服务」
的信号（external_required），纯本地不实现真实识别，绝不抛异常。
设计文档见任务分解 T03。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

from app.modules.base import ModuleBase

logger = logging.getLogger("pomos.module.m15")

# 题面/上下文中的多模态标记（中英文）
_IMAGE_MARKERS = ["图片", "图", "照片", "截图", "image", "photo", "picture", "ocr"]
_FORMULA_MARKERS = ["公式", "手写公式", "latex", "formula", "equation"]


def _detect_modality(ctx: Dict[str, Any]) -> Tuple[List[str], bool, str]:
    """检测输入模态。

    返回 (modalities, external_required, reason)。
    - 检测到图片/公式输入 → external_required=True，需外部 OCR/LLM 服务。
    - 纯文本 → external_required=False。
    任何异常均安全回退为纯文本、无需外部服务。
    """
    try:
        if not isinstance(ctx, dict):
            return ["text"], False, ""
        has_image = bool(ctx.get("image"))
        has_formula = bool(ctx.get("formula"))
        message = (ctx.get("message") or "").lower()
        if any(m in message for m in _IMAGE_MARKERS):
            has_image = True
        if any(m in message for m in _FORMULA_MARKERS):
            has_formula = True

        if has_image and has_formula:
            return ["image", "formula", "text"], True, "需外部 OCR/LLM 多模态服务"
        if has_image:
            return ["image", "text"], True, "需外部 OCR/LLM 多模态服务"
        if has_formula:
            return ["formula", "text"], True, "需外部公式识别（LaTeX/OCR）服务"
        return ["text"], False, ""
    except Exception:
        return ["text"], False, ""


class MultimodalModule(ModuleBase):
    name = "m15_multimodal"
    layer = "Runtime"
    spec = "15_Unified_Multimodal_Learning_Intelligence_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：检测多模态输入 → 结构化降级返回。

        检测到图片/公式 → 返回 external_required=True 与明确 reason，next 特例指向
        ``external_multimodal_required``；纯文本则 external_required=False。
        全程 try/except 包裹，绝不抛异常。
        """
        try:
            modalities, external_required, reason = _detect_modality(ctx)
        except Exception as exc:  # 极端兜底：绝不抛异常
            logger.warning("m15 degrade: %s", exc)
            modalities, external_required, reason = ["text"], False, ""

        if not reason:
            reason = "纯文本输入，无需外部多模态服务"

        logger.info(
            "m15 multimodal: modalities=%s external_required=%s",
            modalities, external_required,
        )
        return {
            "module": self.name,
            "action": "parse_modality",
            "output": {
                "modalities": modalities,
                "external_required": external_required,
                "reason": reason,
            },
            "next": "external_multimodal_required",
        }
