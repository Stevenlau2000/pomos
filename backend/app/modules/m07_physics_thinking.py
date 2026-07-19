"""POMOS 规范模块 07_Physics_Thinking_Engine（Knowledge 层）。

十阶段物理思维链：从问题表征到元认知监控的完整推理路径。
``trace_thinking(message, twin, lang)`` 返回十个阶段（每阶段含 stage_no/name/status/hint），
基于题面关键词给出启发式提示（规则模板，不调 LLM）。双语。
设计文档见任务分解 T03。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from app.modules.base import ModuleBase
from app.modules._common import _lang, safe_twin

logger = logging.getLogger("pomos.module.m07")

# 十阶段（中文名, 英文名）
_STAGES: List[Tuple[str, str]] = [
    ("问题表征", "Problem Representation"),
    ("物理图像", "Physical Picture"),
    ("模型选择", "Model Selection"),
    ("数学映射", "Mathematical Mapping"),
    ("求解执行", "Solution Execution"),
    ("结果检验", "Result Verification"),
    ("概念理解", "Conceptual Understanding"),
    ("迁移应用", "Transfer & Application"),
    ("反思复盘", "Reflection & Review"),
    ("元认知监控", "Metacognitive Monitoring"),
]

# 题面关键词 -> 板块（用于启发式 nudge）；先放具体概念词，再放板块名（兜底匹配）
_BOARD_KEYWORDS: List[Tuple[str, str]] = [
    ("电磁感应", "电磁学"), ("磁场", "电磁学"), ("静电", "电磁学"),
    ("电路", "电磁学"), ("电荷", "电磁学"), ("电势", "电磁学"), ("电磁学", "电磁学"),
    ("牛顿", "力学"), ("刚体", "力学"), ("转动", "力学"),
    ("动量", "力学"), ("振动", "力学"), ("波", "力学"), ("力学", "力学"),
    ("热", "热学"), ("温度", "热学"), ("气体", "热学"), ("熵", "热学"), ("热学", "热学"),
    ("折射", "光学"), ("干涉", "光学"), ("衍射", "光学"), ("光学", "光学"),
    ("量子", "近代物理"), ("相对论", "近代物理"), ("原子", "近代物理"), ("光电", "近代物理"),
    ("近代物理", "近代物理"),
]

# 板块 -> 针对性提示（追加到相关阶段）
_TOPIC_HINTS: Dict[str, str] = {
    "力学": "关注受力分析（隔离体法）与参考系选择，先厘清对象再列方程。",
    "电磁学": "先判断电场/磁场分布，再用 ε=BLv、I=ε/R 等控制关系搭建方程链。",
    "热学": "明确系统边界与过程（等温/等压/绝热），注意微观解释与宏观量的对应。",
    "光学": "用几何近似或波动模型，关注边界条件与相位关系。",
    "近代物理": "从守恒量（能量/动量）与量子化条件切入，注意相对论修正。",
}

# 每阶段基础提示（zh / en）
_STAGE_HINTS_ZH: List[str] = [
    "提取已知量、未知量与约束条件，用符号而非数字表述问题。",
    "在脑中画出物理图景：对象、受力/场、运动与相互作用。",
    "选择合适模型（质点/刚体/场/波），写明适用条件与近似。",
    "建立控制方程：守恒量、本构关系或运动方程，注意矢量方向。",
    "逐步求解，保留符号推导，最后再代入数值与单位。",
    "做量纲检查、极限与特例检验，确认结果物理合理。",
    "回到概念本质：这个结果说明了什么物理规律？",
    "思考能否把方法迁移到另一个情境（不同条件/不同板块）。",
    "复盘关键决策：哪里容易错？为什么这样想才对？",
    "监控自己的思路：是否跳步、是否混淆了表象与本质。",
]
_STAGE_HINTS_EN: List[str] = [
    "Extract knowns, unknowns and constraints; state the problem with symbols, not numbers.",
    "Build the physical picture: objects, forces/fields, motion and interactions.",
    "Choose a model (particle/rigid body/field/wave); state its conditions and approximations.",
    "Write governing equations: conserved quantities, constitutive or equations of motion; watch vector directions.",
    "Solve step by step with symbolic derivation; substitute numbers and units only at the end.",
    "Check dimensions, limits and special cases; confirm the result is physically reasonable.",
    "Return to the concept: what physical law does this result illustrate?",
    "Think how to transfer the method to another context (different condition/board).",
    "Review key decisions: where is it easy to err, and why is this the right way?",
    "Monitor your own reasoning: any skipped steps, any confusion of appearance vs essence?",
]


def _detect_board(message: str) -> Optional[str]:
    """从题面关键词启发式判断板块（命中第一个即返回）。"""
    text = (message or "")
    for kw, board in _BOARD_KEYWORDS:
        if kw in text:
            return board
    return None


def _stage_hint(i: int, en: bool, board: Optional[str]) -> str:
    """构造第 i 阶段（1-based）的提示文本。"""
    base = (_STAGE_HINTS_EN if en else _STAGE_HINTS_ZH)[i - 1]
    if board and i in (2, 3):  # 物理图像 / 模型选择 阶段追加针对性 nudge
        nudge = _TOPIC_HINTS.get(board, "")
        if nudge:
            return f"{base}（{board}）{nudge}" if not en else f"{base} ({board}) {nudge}"
    return base


def trace_thinking(
    message: str,
    twin: Optional[Dict[str, float]] = None,
    lang: str = "zh",
) -> Dict[str, Any]:
    """十阶段物理思维管线。

    返回 {stages:[{stage_no,name,status,hint}×10], stage_count:10, summary:str}。
    第一阶段为 active，其余 pending；每阶段提示均非空（规则模板，不调 LLM）。
    """
    en = (lang or "zh") == "en"
    board = _detect_board(message)
    stages: List[Dict[str, Any]] = []
    for i, (zh_name, en_name) in enumerate(_STAGES, start=1):
        name = en_name if en else zh_name
        status = "active" if i == 1 else "pending"
        hint = _stage_hint(i, en, board)
        stages.append({
            "stage_no": i,
            "name": name,
            "status": status,
            "hint": hint,
        })

    if en:
        summary = (
            f"10-stage thinking pipeline generated"
            + (f" (topic inferred: {board})" if board else "")
            + ". Stage 1 is active; follow the hints stage by stage."
        )
    else:
        summary = (
            "已生成十阶段物理思维管线"
            + (f"（推断板块：{board}）" if board else "")
            + "。第一阶段为当前焦点，请按提示逐阶段推进。"
        )
    return {
        "stages": stages,
        "stage_count": len(stages),
        "summary": summary,
    }


class PhysicsThinkingModule(ModuleBase):
    name = "m07_physics_thinking"
    layer = "Knowledge"
    spec = "07_Physics_Thinking_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：取 message + safe_twin → trace_thinking → 标准返回。

        防御式：缺字段绝不抛异常；空 message 也能产出十阶段（无针对性 nudge）。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        twin = safe_twin(ctx)
        message = ctx.get("message", "") or ""
        trace = trace_thinking(message, twin, lang)
        logger.info("m07 thinking: stages=%d", trace.get("stage_count"))
        return {
            "module": self.name,
            "action": "trace_thinking",
            "output": trace,
            "next": "m08_teaching_strategy",
        }
