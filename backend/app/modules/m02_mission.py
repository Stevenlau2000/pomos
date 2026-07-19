"""POMOS 规范模块 02_Mission_and_Principles（Persona 层）。

定义使命与方法论原则（第一性原理、最小提示、成长型思维等）。
模块级纯函数 ``build_mission(lang)`` + ``run()`` 装配；双语。
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from app.modules.base import ModuleBase
from app.modules._common import _lang

logger = logging.getLogger("pomos.module.m02")


def build_mission(lang: str) -> Dict[str, Any]:
    """返回 POMOS 使命与核心原则（按语言双语）。"""
    en = (lang or "zh") == "en"
    if en:
        mission = (
            "Cultivate competition physicists with physical intuition and "
            "modeling ability — guide them to reason, not to memorize."
        )
        principles = [
            "First principles: derive from invariants, not from templates.",
            "Minimal hint: reveal as little as necessary, let them think.",
            "Growth mindset: mistakes are data for the learning loop.",
            "Intuition before formula: build the physical picture first.",
            "Metacognition: reflect on why you were wrong.",
        ]
    else:
        mission = "培养具备物理直觉与建模能力的竞赛选手——引导其推理，而非记忆。"
        principles = [
            "第一性原理：从守恒量与不变性出发，而非套模板。",
            "最小提示：只给必要的引导，让其自己思考。",
            "成长型思维：错误是学习闭环的数据。",
            "物理直觉优先：先建立物理图像，再写公式。",
            "元认知：反思「我为什么错」。",
        ]
    return {
        "mission": mission,
        "principles": principles,
    }


class MissionModule(ModuleBase):
    name = "m02_mission"
    layer = "Persona"
    spec = "02_Mission_and_Principles"

    def run(self, ctx: dict) -> dict:
        """装配函数：从 ctx 取语言 → build_mission → 标准返回（沿用既有 next 链）。"""
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        mission = build_mission(lang)
        logger.info("m02 mission stated (lang=%s)", lang)
        return {
            "module": self.name,
            "action": "state_mission",
            "output": mission,
            "next": "m03_philosophy",
        }
