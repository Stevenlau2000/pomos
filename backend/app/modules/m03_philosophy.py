"""POMOS 规范模块 03_Teaching_Philosophy（Persona 层）。

确立「先物理后公式」、苏格拉底式提问 + 脚手架 + 元认知的教学信条。
模块级纯函数 ``build_philosophy(lang)`` + ``run()`` 装配；双语。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.modules.base import ModuleBase
from app.modules._common import _lang

logger = logging.getLogger("pomos.module.m03")

# 三类信条模板（苏格拉底式提问 / 脚手架递进 / 元认知反思），每类含 zh/en 文本
_PHIL_TEMPLATES: List[Dict[str, str]] = [
    {
        "type": "苏格拉底式提问",
        "type_en": "Socratic Questioning",
        "zh": "不直接给答案，而是用一连串追问暴露隐含假设、逼近物理本质。",
        "en": "Do not hand the answer; use a chain of questions to surface hidden "
              "assumptions and approach the physical essence.",
    },
    {
        "type": "脚手架递进",
        "type_en": "Scaffolded Progression",
        "zh": "把难题拆成可吞咽的小步：先建图像，再列方程，最后求解与检验。",
        "en": "Break hard problems into bite-sized steps: picture first, then "
              "equations, then solve and verify.",
    },
    {
        "type": "元认知反思",
        "type_en": "Metacognitive Reflection",
        "zh": "每轮结束让学生复盘：我卡在哪、为什么错、下次如何避免。",
        "en": "After each round, ask the student to reflect: where did I stall, "
              "why was I wrong, how to avoid it next time.",
    },
]


def build_philosophy(lang: str) -> Dict[str, Any]:
    """返回教学哲学设定（按语言双语）。

    字段：style / scaffolding(bool) / philosophy_templates(≥3 类信条，每类含 zh/en 文本)。
    """
    en = (lang or "zh") == "en"
    templates = []
    for t in _PHIL_TEMPLATES:
        if en:
            templates.append({
                "type": t["type_en"],
                "text": t["en"],
            })
        else:
            templates.append({
                "type": t["type"],
                "text": t["zh"],
            })
    return {
        "style": (
            "Socratic questioning + progressive hints, picture-before-formula"
            if en else
            "苏格拉底式提问 + 渐进提示，先物理图像后公式"
        ),
        "scaffolding": True,
        "philosophy_templates": templates,
    }


class PhilosophyModule(ModuleBase):
    name = "m03_philosophy"
    layer = "Persona"
    spec = "03_Teaching_Philosophy"

    def run(self, ctx: dict) -> dict:
        """装配函数：从 ctx 取语言 → build_philosophy → 标准返回（沿用既有 next 链）。"""
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        philosophy = build_philosophy(lang)
        logger.info("m03 philosophy applied (lang=%s)", lang)
        return {
            "module": self.name,
            "action": "apply_philosophy",
            "output": philosophy,
            "next": "m04_student_model",
        }
