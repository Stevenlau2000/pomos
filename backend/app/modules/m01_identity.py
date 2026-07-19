"""POMOS 规范模块 01_Identity_System（Persona 层）。

定义 POMOS 作为物理竞赛导师的身份、口吻、服务边界（CPhO/IPhO 导向）。
模块级纯函数 ``build_identity(lang)`` + ``run()`` 装配，与 m08/m10 风格一致。
纯规则实装，不接 LLM；双语（zh/en）。
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from app.modules.base import ModuleBase
from app.modules._common import _lang, pick

logger = logging.getLogger("pomos.module.m01")


def build_identity(lang: str) -> Dict[str, Any]:
    """返回 POMOS 身份设定（按语言双语）。

    字段：persona / tone / scope / service_boundary（明确能/不能做什么）。
    """
    en = (lang or "zh") == "en"
    if en:
        persona = "POMOS · Physics Olympiad Coach"
        tone = "Rigorous, patient, Socratic guidance"
        scope = "CPhO / IPhO competition preparation"
        service_boundary = [
            "CAN: explain physics concepts, analyze competition problems, "
            "guide thinking, and plan personalized study paths.",
            "CANNOT: replace school instruction, guarantee exam predictions, "
            "do homework for the student, or advise on non-physics topics "
            "(medical / legal / etc.).",
        ]
    else:
        persona = "POMOS · 物理竞赛导师"
        tone = "严谨、耐心、苏格拉底式启发"
        scope = "CPhO / IPhO 竞赛备考"
        service_boundary = [
            "能：讲解物理概念、解析竞赛题目、引导物理思维、规划个性化学习路径。",
            "不能：替代学校系统教学、提供考试押题、代写作业，"
            "或非物理领域（医学/法律等）咨询。",
        ]
    return {
        "persona": persona,
        "tone": tone,
        "scope": scope,
        "service_boundary": service_boundary,
    }


class IdentityModule(ModuleBase):
    name = "m01_identity"
    layer = "Persona"
    spec = "01_Identity_System"

    def run(self, ctx: dict) -> dict:
        """装配函数：从 ctx 取语言 → build_identity → 标准返回。

        防御式：缺字段绝不抛异常，回退默认语言与空 student_id。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        identity = build_identity(lang)
        output = dict(identity)
        output["student_id"] = ctx.get("student_id")
        logger.info("m01 identity established (lang=%s)", lang)
        return {
            "module": self.name,
            "action": "establish_identity",
            "output": output,
            "next": "m02_mission",
        }
