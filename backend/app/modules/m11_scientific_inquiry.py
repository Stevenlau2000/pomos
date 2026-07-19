"""POMOS 规范模块 11_Scientific_Inquiry_and_Experimental_Intelligence_Engine（Teaching 层）。

SIEE：科学探究与实验智能——设计实验、误差分析、数据处理。
- ``design_experiment(goal, lang)``：按目标匹配模板，输出结构化实验设计。
- ``error_analysis(lang)``：结构化的不确定度模型（A类=多次测量标准差 s/√n；
  B类=仪器允差 Δ/√3；合成 u_c=√(u_A²+u_B²)）；不做真实数值拟合。
- ``data_fitting(lang)``：建议拟合方法（逐差法 / 最小二乘）。
模板取自 ``app.data.inquiry_templates``。纯规则，不接 LLM；双语。
设计文档见任务分解 T04。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.modules.base import ModuleBase
from app.modules._common import _lang
from app.data.inquiry_templates import INQUIRY_TEMPLATES

logger = logging.getLogger("pomos.module.m11")

# 模板平铺索引（便于按关键词命中）
_TEMPLATE_BY_ID: Dict[str, Dict[str, Any]] = {t["id"]: t for t in INQUIRY_TEMPLATES}


def design_experiment(goal: str, lang: str = "zh") -> str:
    """根据实验目标匹配模板，输出结构化实验设计文本。

    命中规则：目标文本含模板 keywords 之一即选用；否则用首个模板（通用兜底）。
    """
    en = (lang or "zh") == "en"
    goal_low = (goal or "").lower()
    chosen = None
    for t in INQUIRY_TEMPLATES:
        for kw in t.get("keywords", []):
            if kw.lower() in goal_low:
                chosen = t
                break
        if chosen:
            break
    if chosen is None:
        chosen = INQUIRY_TEMPLATES[0]

    if en:
        steps = "\n".join(
            f"{i+1}. {s}" for i, s in enumerate(chosen.get("design_steps_en") or chosen.get("design_steps", []))
        )
        text = f"Experiment goal: {chosen.get('goal_en') or chosen.get('goal')}\nDesign steps:\n{steps}"
    else:
        steps = "\n".join(
            f"{i+1}. {s}" for i, s in enumerate(chosen.get("design_steps", []))
        )
        text = f"实验目标：{chosen.get('goal')}\n设计步骤：\n{steps}"
    return text


def error_analysis(lang: str = "zh") -> Dict[str, Any]:
    """结构化的误差/不确定度分析模型（不做真实数值拟合）。"""
    en = (lang or "zh") == "en"
    if en:
        return {
            "uncertainty": {
                "A类 (Type-A)": "u_A = s / sqrt(n), where s is the sample standard "
                                "deviation over n repeated measurements.",
                "B类 (Type-B)": "u_B = Δ / sqrt(3), where Δ is the instrument tolerance limit.",
                "combined": "u_c = sqrt(u_A^2 + u_B^2).",
            },
            "note": "Structured template only; no live numerical evaluation is performed here.",
        }
    return {
        "uncertainty": {
            "A类": "A类不确定度：u_A = s/√n，s 为 n 次测量的样本标准差。",
            "B类": "B类不确定度：u_B = Δ/√3，Δ 为仪器允许误差限。",
            "combined": "合成不确定度：u_c = √(u_A² + u_B²)。",
        },
        "note": "仅输出结构化模板，不做真实数值拟合。",
    }


def data_fitting(lang: str = "zh") -> str:
    """建议的数据拟合方法。"""
    en = (lang or "zh") == "en"
    if en:
        return (
            "Recommended fitting: use the successive-difference method (逐差法) for "
            "equally spaced measurements; for general trends apply least squares (最小二乘) "
            "to obtain slope/intercept with uncertainty propagation."
        )
    return (
        "建议方法：等间距数据优先用逐差法；一般趋势用最小二乘法拟合，"
        "同时给出斜率/截距及不确定度。"
    )


class ScientificInquiryModule(ModuleBase):
    name = "m11_scientific_inquiry"
    layer = "Teaching"
    spec = "11_Scientific_Inquiry_and_Experimental_Intelligence_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：取 message(实验目标) + twin → 设计/误差/拟合 → 标准返回。

        防御式：缺字段绝不抛异常；空目标也能产出通用实验设计模板。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        message = ctx.get("message", "") or ""

        experiment_design = design_experiment(message, lang)
        ea = error_analysis(lang)
        fit = data_fitting(lang)

        logger.info("m11 inquiry: goal_len=%d", len(message))
        return {
            "module": self.name,
            "action": "design_experiment",
            "output": {
                "experiment_design": experiment_design,
                "error_analysis": ea,
                "data_fitting": fit,
            },
            "next": "m12_learning_orchestration",
        }
