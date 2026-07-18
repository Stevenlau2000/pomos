"""POMOS 规范模块 08_Teaching_Strategy_Engine（Teaching 层）。

六模式 + 五级 Hint：根据学情（九维 twin + 诊断）与目标路由出
六教学模式之一（讲授/探究/支架/对练/复盘/拓展），并给出初始 Hint 等级。
纯规则实装，不接 LLM；可离线 pytest，可被子 Orchestrator 调度。

设计文档见 ``docs/architecture_m08_m10.md`` §3.1 / §4。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.modules.base import ModuleBase
from app.modules.assessment_engine import NINE_DIMS, detect_misconceptions
from app.config import settings

logger = logging.getLogger("pomos.module.m08")

# 弱维阈值：twin 某维低于此值视为薄弱
WEAK_THRESHOLD: float = 0.5

# 六教学模式
MODE_LECTURE = "讲授"
MODE_INQUIRY = "探究"
MODE_SCAFFOLD = "支架"
MODE_DRILL = "对练"
MODE_REVIEW = "复盘"
MODE_EXTEND = "拓展"

# 讲授模式下的类比/支架提示（可选）
_SCAFFOLD_HINT: Dict[str, str] = {
    "zh": "用生活类比先建立直觉：想象……再回到严格定义，区分「表象」与「本质」。",
    "en": "Build intuition with an everyday analogy first, then return to the strict "
          "definition and separate 'appearance' from 'essence'.",
}


def _avg_mastery(twin: Dict[str, float]) -> float:
    """九维均值（0~1）。缺字段按 0 计。"""
    if not twin:
        return 0.0
    vals = [float(twin.get(d, 0.0) or 0.0) for d in NINE_DIMS]
    return sum(vals) / max(1, len(vals))


def _weak_dims(twin: Dict[str, float]) -> List[str]:
    """返回低于阈值的维度列表（保持 NINE_DIMS 顺序）。"""
    return [d for d in NINE_DIMS if (twin.get(d, 0.0) or 0.0) < WEAK_THRESHOLD]


def route_mode(signals: Dict[str, Any]) -> str:
    """六模式决策表（按文档 §4.1 优先级 1-6 + 默认）。

    signals = {
      "has_misconception": bool,
      "weak_dims": list[str],          # twin 低于阈值的维度
      "goal_type": str,               # learn_new|consolidate|apply|review|extend
      "recent_practice": bool,        # 近期是否练过（可选）
      "avg_mastery": float,           # 九维均值 0~1
    }
    返回: "讲授"|"探究"|"支架"|"对练"|"复盘"|"拓展"
    """
    has_mis = bool(signals.get("has_misconception", False))
    weak = list(signals.get("weak_dims", []) or [])
    goal = (signals.get("goal_type") or "learn_new")
    recent = bool(signals.get("recent_practice", False))
    avg = float(signals.get("avg_mastery", 0.0) or 0.0)

    # 1) 顽固错误概念 → 讲授（优先纠正迷思）
    if has_mis:
        return MODE_LECTURE
    # 2) 新学 + 概念/建模弱 → 探究
    if goal == "learn_new" and ("concept" in weak or "modeling" in weak):
        return MODE_INQUIRY
    # 3) 新学 + 其它弱维 → 支架
    if goal == "learn_new" and weak:
        return MODE_SCAFFOLD
    # 4) 巩固 + 均值够高 → 对练
    if goal == "consolidate" and avg >= 0.6:
        return MODE_DRILL
    # 5) 复习 或 近期练过 → 复盘
    if goal == "review" or recent:
        return MODE_REVIEW
    # 6) 拓展 或 高掌握 → 拓展
    if goal == "extend" or avg >= 0.75:
        return MODE_EXTEND
    # 默认：稳妥渐进
    return MODE_SCAFFOLD


def initial_hint_level(
    twin: Dict[str, float],
    diagnosis: List[Dict[str, Any]],
    problem_meta: Optional[Dict[str, Any]] = None,
) -> int:
    """返回 1~5 的初始 Hint 等级。

    规则：难度越高 / 掌握度越低 → 起始等级越高（更喂提示）；
    有顽固错误概念 → +1 级（更多支架）。
    problem_meta = {"board": str, "difficulty": 1~5, "topic": str} 或 None。
    """
    difficulty = 3
    if isinstance(problem_meta, dict):
        try:
            difficulty = float(problem_meta.get("difficulty") or 3)
        except (TypeError, ValueError):
            difficulty = 3
    avg = _avg_mastery(twin)
    base = int(round(difficulty - avg * 4))
    base = max(1, min(5, base))
    if diagnosis:
        base = min(5, base + 1)
    return base


def generate_hint(
    level: int,
    problem_meta: Optional[Dict[str, Any]] = None,
    lang: str = "zh",
) -> str:
    """五级 Hint 文本生成器（纯规则模板，不调 LLM）。

    level1 方向性 / level2 思路框架 / level3 关键步骤 /
    level4 近乎完整推导 / level5 答案。
    problem_meta 用于按板块/难度选模板；缺失时用通用模板。
    """
    level = max(1, min(5, int(level or 1)))
    board = (problem_meta or {}).get("board") if isinstance(problem_meta, dict) else None
    en = (lang or "zh").lower() == "en"

    if en:
        templates = {
            1: "First identify which conserved quantity/law this problem involves "
               "(energy? momentum? angular momentum?), and think along that direction.",
            2: "Suggested steps: ① Force/field analysis ② Choose the object "
               "(whole/isolated) ③ Write conservation/Newton equations "
               "④ Set boundary conditions and solve.",
            3: "Write down the governing relation for the core quantity (e.g. "
               "ε = BLv for motional EMF), then build the equation chain from it.",
            4: "Here is the formula chain: from the governing law derive the "
               "intermediate expressions; only the final numeric substitution is left to you.",
            5: "Reference solution outline: state the object and conserved quantity "
               "clearly, set up and solve the equations, then check units and signs.",
        }
    else:
        templates = {
            1: "先判断本题涉及哪个守恒量/定律（能量？动量？角动量？），朝这个方向想。",
            2: "建议步骤：①受力/场分析 ②选研究对象(整体/隔离) ③列守恒/牛顿方程 "
               "④定边界条件求解。",
            3: "写出核心物理量的控制关系（如动生电动势 ε=BLv），再由此搭建方程链。",
            4: "给出公式链：由控制定律推导出中间表达式，仅留最终数值代入给你完成。",
            5: "完整参考解答要点：明确研究对象与守恒量，列方程并求解，注意单位与符号。",
        }

    hint = templates[level]

    # 板块特化（电磁学感应类关键步骤）
    if not en and board == "电磁学" and level == 3:
        hint = "对导体棒考虑感应电动势 ε=BLv 与回路电流 I=ε/R，再算安培力。"

    return hint


def _build_rationale(
    mode: str,
    signals: Dict[str, Any],
    hint_level: int,
    lang: str,
) -> str:
    """生成中文/英文决策理由（供可解释）。"""
    en = (lang or "zh").lower() == "en"
    weak = signals.get("weak_dims") or []
    avg = signals.get("avg_mastery", 0.0)
    goal = signals.get("goal_type", "learn_new")

    if en:
        weak_str = ", ".join(weak) if weak else "none"
        base = (
            f"Mode={mode}; goal={goal}; avg_mastery={avg:.2f}; "
            f"weak_dims=[{weak_str}]; initial hint_level={hint_level}."
        )
        if mode == MODE_LECTURE:
            base += " Persistent misconception detected, so lecture + analogy first."
        elif mode == MODE_INQUIRY:
            base += " New topic with weak concept/modeling, guide to build the image."
        elif mode == MODE_SCAFFOLD:
            base += " New topic with gaps, scaffold step by step."
        elif mode == MODE_DRILL:
            base += " Consolidation with solid mastery, give variations."
        elif mode == MODE_REVIEW:
            base += " Review/recent practice, ask the student to explain."
        elif mode == MODE_EXTEND:
            base += " High mastery or extension goal, cross-context transfer."
        return base

    weak_str = "、".join(weak) if weak else "无"
    base = (
        f"模式={mode}；目标={goal}；平均掌握度={avg:.2f}；"
        f"薄弱维=[{weak_str}]；初始 Hint 等级={hint_level}。"
    )
    if mode == MODE_LECTURE:
        base += "检测到顽固错误概念，先讲授纠正并用类比/支架。"
    elif mode == MODE_INQUIRY:
        base += "新学且概念/建模薄弱，引导其自己建立物理图像。"
    elif mode == MODE_SCAFFOLD:
        base += "新学且存在其它薄弱，分步搭脚手架渐进推进。"
    elif mode == MODE_DRILL:
        base += "巩固目标且掌握度较高，多给同型变式对练。"
    elif mode == MODE_REVIEW:
        base += "复习/近期练过，让学生讲思路、找错因。"
    elif mode == MODE_EXTEND:
        base += "掌握度高或拓展目标，进行跨情境迁移/压轴。"
    return base


def select_strategy(
    twin: Dict[str, float],
    diagnosis: List[Dict[str, Any]],
    goal: Optional[Dict[str, Any]] = None,
    lang: str = "zh",
) -> Dict[str, Any]:
    """策略决策主入口（m10 也直接调用本函数）。

    返回 strategy dict:
    {
      "mode": str,                 # 六模式之一
      "hint_level": int,           # 1~5 初始等级
      "rationale": str,            # 决策理由（中文/英文，供可解释）
      "target_dims": list[str],    # 重点针对的九维
      "scaffolding": str|None,     # 讲授模式下的类比/支架提示（可选）
    }
    """
    goal = goal or {}
    if not isinstance(goal, dict):
        goal = {}
    goal_type = goal.get("goal_type") or "learn_new"
    problem_meta = goal.get("problem_meta")
    recent_practice = bool(goal.get("recent_practice", False))

    twin = {d: float(twin.get(d, 0.0) or 0.0) for d in NINE_DIMS} if twin else {d: 0.0 for d in NINE_DIMS}
    has_mis = bool(diagnosis)
    weak = _weak_dims(twin)
    avg = _avg_mastery(twin)

    signals = {
        "has_misconception": has_mis,
        "weak_dims": weak,
        "goal_type": goal_type,
        "recent_practice": recent_practice,
        "avg_mastery": avg,
    }
    mode = route_mode(signals)
    hint_level = initial_hint_level(twin, diagnosis, problem_meta)

    # target_dims：错误概念维度优先，其次弱维，否则全维
    target_dims: List[str] = []
    if has_mis:
        for d in diagnosis:
            for dim in d.get("dims", []):
                if dim not in target_dims:
                    target_dims.append(dim)
    if not target_dims:
        target_dims = list(weak) if weak else list(NINE_DIMS)

    # scaffolding：仅讲授模式有意义
    scaffolding: Optional[str] = None
    if mode == MODE_LECTURE:
        scaffolding = _SCAFFOLD_HINT.get("en" if (lang or "zh").lower() == "en" else "zh")

    rationale = _build_rationale(mode, signals, hint_level, lang)

    return {
        "mode": mode,
        "hint_level": hint_level,
        "rationale": rationale,
        "target_dims": target_dims,
        "scaffolding": scaffolding,
    }


class TeachingStrategyModule(ModuleBase):
    name = "m08_teaching_strategy"
    layer = "Teaching"
    spec = "08_Teaching_Strategy_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：从 ctx 取 twin/diagnosis/goal → select_strategy → 标准返回。

        - twin 来源：ctx["twin"]（接入点1 注入）或 ctx["student_ctx"]["twin"] 或 全 0 默认。
        - diagnosis 来源：detect_misconceptions(ctx["message"], lang)。
        - goal 来源：_infer_goal(ctx)（由 message 关键词推断 goal_type）。
        防御式：缺字段绝不抛异常，回退默认值。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = (settings.coach_language or "zh").lower()
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}

        twin_raw = ctx.get("twin") or student_ctx.get("twin") or {}
        twin = {d: float((twin_raw or {}).get(d, 0.0) or 0.0) for d in NINE_DIMS}

        message = ctx.get("message", "") or ""
        diagnosis = detect_misconceptions(message, lang)
        goal = self._infer_goal(ctx)
        strategy = select_strategy(twin, diagnosis, goal, lang)

        logger.info(
            "m08 strategy: mode=%s hint_level=%s target_dims=%s",
            strategy["mode"], strategy["hint_level"], strategy["target_dims"],
        )

        return {
            "module": self.name,
            "action": "select_strategy",
            "output": {
                "mode": strategy["mode"],
                "hint_level": strategy["hint_level"],
                "rationale": strategy["rationale"],
                "target_dims": strategy["target_dims"],
                "scaffolding": strategy["scaffolding"],
            },
            "next": "m09_olympiad_problem",
        }

    def _infer_goal(self, ctx: dict) -> dict:
        """从 message/student_ctx 推断 goal_type 与 problem_meta（防御式，缺省 learn_new）。

        goal_type：复习→review / 拓展→extend / 练→consolidate / 应用→apply / 其它→learn_new。
        problem_meta 优先读 ctx["student_ctx"].get("problem_meta")。
        """
        if not isinstance(ctx, dict):
            return {"goal_type": "learn_new", "problem_meta": None, "recent_practice": False}
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}
        message = ctx.get("message", "") or ""
        problem_meta = student_ctx.get("problem_meta")

        goal_type = "learn_new"
        if any(k in message for k in ("复习", "复盘")):
            goal_type = "review"
        elif any(k in message for k in ("拓展", "进阶", "拔高")):
            goal_type = "extend"
        elif any(k in message for k in ("练", "刷题", "巩固")):
            goal_type = "consolidate"
        elif any(k in message for k in ("应用", "做")):
            goal_type = "apply"

        recent_practice = bool(student_ctx.get("recent_practice", False))

        return {
            "goal_type": goal_type,
            "problem_meta": problem_meta,
            "recent_practice": recent_practice,
        }
