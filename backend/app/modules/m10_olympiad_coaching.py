"""POMOS 规范模块 10_Adaptive_Olympiad_Coaching_System（Teaching 层）。

AOCS：自适应教练系统——围绕单题进行多轮引导与即时反馈。
核心是一个状态机（DIAGNOSE→GUIDE→FEEDBACK→REINFORCE→DONE）：
评估学生本轮作答、推进 Hint 等级、决定下一步动作（追问/给提示/讲解/换题/复盘总结）。

纯规则实装，不接 LLM；依赖 m08 的 select_strategy / generate_hint（同源策略）。
设计文档见 ``docs/architecture_m08_m10.md`` §3.2 / §5。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.modules.base import ModuleBase
from app.modules.m08_teaching_strategy import select_strategy, generate_hint
from app.modules.assessment_engine import NINE_DIMS, detect_misconceptions
from app.config import settings

logger = logging.getLogger("pomos.module.m10")

# 收敛阈值：连对 N 次即结课
CORRECT_STREAK_TO_DONE: int = 2
# Hint 等级上限
MAX_HINT_LEVEL: int = 5

# AOCS 状态
ST_DIAGNOSE = "DIAGNOSE"
ST_GUIDE = "GUIDE"
ST_FEEDBACK = "FEEDBACK"
ST_REINFORCE = "REINFORCE"
ST_DONE = "DONE"


def _safe_state(prev_state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """防御式读取上轮状态，缺字段回退默认。"""
    prev = dict(prev_state or {})
    try:
        turn = int(prev.get("turn", 0))
    except (TypeError, ValueError):
        turn = 0
    try:
        hint_level = int(prev.get("hint_level", 1))
    except (TypeError, ValueError):
        hint_level = 1
    try:
        streak = int(prev.get("streak_correct", 0))
    except (TypeError, ValueError):
        streak = 0
    status = prev.get("status", ST_DIAGNOSE)
    return {
        "turn": turn,
        "hint_level": max(1, min(MAX_HINT_LEVEL, hint_level)),
        "streak_correct": max(0, streak),
        "status": status,
    }


def evaluate_answer(
    student_answer: str,
    reference: Optional[Dict[str, Any]] = None,
    lang: str = "zh",
) -> str:
    """规则评估本轮作答：返回 "correct" | "partial" | "wrong"。

    - reference = {"key_steps":[str], "answer_keywords":[str]} 或 None。
    - correct: 命中全部 key_steps/关键词；wrong: 命中极少或含自相矛盾；partial: 居中。
    - reference 为 None（无题面元信息）→ 默认 "partial"，交由追问澄清。
    """
    ans = (student_answer or "").strip()
    low = ans.lower()

    # 空作答 / 明显放弃 → wrong
    if not ans:
        return "wrong"
    # 自相矛盾 / 放弃信号 → wrong
    if any(k in low for k in ("错了", "不对", "不会", "不知道", "我错了", "算不出")):
        return "wrong"

    # 无题面元信息 → 无法判定，partial 交由追问澄清
    if not isinstance(reference, dict):
        return "partial"
    key_steps = reference.get("key_steps") or []
    keywords = reference.get("answer_keywords") or []

    step_hits = sum(1 for s in key_steps if s and s.lower() in low) if key_steps else 0
    kw_hits = sum(1 for k in keywords if k and k.lower() in low) if keywords else 0
    total = len(key_steps) + len(keywords)
    if total == 0:
        # 有 reference 但无可用关键词，保守判 partial
        return "partial"
    ratio = (step_hits + kw_hits) / max(1, total)

    if ratio >= 0.8:
        return "correct"
    if ratio <= 0.2:
        return "wrong"
    return "partial"


def aocs_transition(
    prev_state: Dict[str, Any],
    evaluation: str,
    lang: str = "zh",
) -> Dict[str, Any]:
    """AOCS 状态机转移（核心可单测函数）。

    返回新 state + 本轮动作决策:
    {
      "turn", "hint_level", "streak_correct", "status",
      "action": "追问"|"给提示"|"讲解"|"换题"|"复盘总结",
      "next_step": str, "feedback": str, "done": bool,
    }
    收敛规则：
      - correct: streak+1；streak>=2 → DONE + 复盘总结。
      - partial: 停留；action=追问。
      - wrong: streak 归零；hint_level+1（封顶 5）：
            <5 → 给提示（升级）；==5 仍错 → 讲解 + DONE。
    """
    en = (lang or "zh").lower() == "en"
    st = _safe_state(prev_state)
    turn = st["turn"] + 1
    hint_level = st["hint_level"]
    streak = st["streak_correct"]
    status = st["status"]

    action = "追问"
    next_step = ""
    done = False

    if evaluation == "correct":
        streak += 1
        if streak >= CORRECT_STREAK_TO_DONE:
            status = ST_DONE
            action = "复盘总结"
            done = True
            next_step = (
                "This round is mastered; let's wrap up with a recap."
                if en else
                "本轮已掌握到位，进入复盘总结。"
            )
        else:
            status = ST_REINFORCE
            action = "追问"
            next_step = (
                "Good, one more step to confirm. Tell me your reasoning."
                if en else
                "不错，再进一步确认：请把你的思路说完整。"
            )
    elif evaluation == "partial":
        status = ST_FEEDBACK
        action = "追问"
        next_step = (
            "Clarify your thinking — what key relation are you using?"
            if en else
            "请进一步说明你的思路，关键步骤用到了哪个关系？"
        )
    elif evaluation == "wrong":
        streak = 0
        if hint_level < MAX_HINT_LEVEL:
            hint_level = min(MAX_HINT_LEVEL, hint_level + 1)
            status = ST_GUIDE
            action = "给提示"
            next_step = (
                "Let me give you a clearer hint to move forward."
                if en else
                "我给你一个更明确的提示，看能否推进。"
            )
        else:
            status = ST_DONE
            action = "讲解"
            done = True
            next_step = (
                "Let me walk through the reference solution directly."
                if en else
                "这道题我直接讲解参考思路，并记录到错题本。"
            )
    else:
        status = ST_DIAGNOSE
        action = "追问"
        next_step = (
            "Let's locate the sticking point first."
            if en else
            "我们先定位一下卡点在哪里。"
        )

    return {
        "turn": turn,
        "hint_level": hint_level,
        "streak_correct": streak,
        "status": status,
        "action": action,
        "next_step": next_step,
        "feedback": "",
        "done": done,
    }


def build_feedback(state: Dict[str, Any], strategy: Dict[str, Any], lang: str = "zh") -> str:
    """按 action + hint_level 拼装反馈文本；action==给提示 时调用 m08.generate_hint。"""
    en = (lang or "zh").lower() == "en"
    action = (state or {}).get("action", "追问")
    hint_level = int((state or {}).get("hint_level", 1) or 1)
    mode = (strategy or {}).get("mode", "支架")

    # 给提示：直接调 m08 的五级 Hint 生成器
    if action == "给提示":
        return generate_hint(hint_level, None, lang)

    # 各 action 的模板（结合 strategy["mode"] 给出更有针对性的追问/讲解）
    inquiry_prompt = (
        "你先说说这道题的物理图像是什么？"
        if not en else
        "First, tell me what the physical picture of this problem is?"
    )
    probe_by_mode = {
        "讲授": ("请复述一下这个概念的定义，以及它适用的条件。",
                 "Repeat the definition of this concept and the conditions it applies to."),
        "探究": (inquiry_prompt, inquiry_prompt),
        "支架": ("我们先迈出第一步：请写出本题要用到的基本方程。",
                 "Let's take the first step: write down the basic equations this problem needs."),
        "对练": ("再试一道同型变式，巩固刚才的方法。",
                 "Try a similar variation to consolidate the method."),
        "复盘": ("把你刚才的解题思路完整讲一遍，并指出可能的错因。",
                 "Walk through your full solution and point out possible mistakes."),
        "拓展": ("尝试把这个方法迁移到一个新情境：条件变了，思路怎么调整？",
                 "Try transferring this method to a new context: if conditions change, how do you adjust?"),
    }

    if action == "讲解":
        return (
            "这道题我们来直接讲解：先明确研究对象与守恒量，列出方程并求解，最后做单位与符号检验。"
            if not en else
            "Let's explain this directly: identify the object and conserved quantity, set up the "
            "equations, solve, then check units and signs."
        )
    if action == "复盘总结":
        return (
            f"连续答对，本轮掌握到位（模式：{mode}）。下面复盘总结要点，并准备进入下一题。"
            if not en else
            f"Two correct in a row — this round is mastered (mode: {mode}). "
            f"Let's recap the key points and move on."
        )
    # 默认：追问（按模式给引导语）
    zh_text, en_text = probe_by_mode.get(mode, probe_by_mode["支架"])
    return en_text if en else zh_text


class OlympiadCoachingModule(ModuleBase):
    name = "m10_olympiad_coaching"
    layer = "Teaching"
    spec = "10_Adaptive_Olympiad_Coaching_System"

    def run(self, ctx: dict) -> dict:
        """装配函数：

        1) strategy = ctx["student_ctx"].get("teaching_strategy")
                      or select_strategy(twin, diagnosis, goal, lang)   # m10→m08 回退依赖
        2) prev_state = ctx["student_ctx"].get("aocs_state")
                      or {"turn":0,"hint_level":strategy["hint_level"],"streak_correct":0,"status":"DIAGNOSE"}
        3) evaluation = evaluate_answer(ctx.get("student_answer"), ctx.get("reference"), lang)
        4) out = aocs_transition(prev_state, evaluation, lang)
        5) out["feedback"] = build_feedback(out, strategy, lang)
        防御式：缺字段绝不抛异常。aocs_state 写回 output 以支持多轮注入。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = (settings.coach_language or "zh").lower()
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}

        twin_raw = ctx.get("twin") or student_ctx.get("twin") or {}
        twin = {d: float((twin_raw or {}).get(d, 0.0) or 0.0) for d in NINE_DIMS}
        message = ctx.get("message", "") or ""
        diagnosis = detect_misconceptions(message, lang)

        # 1) 同源策略：优先用 m08 已写入的，否则回退调用 m08
        strategy = student_ctx.get("teaching_strategy")
        if not isinstance(strategy, dict):
            goal = {
                "goal_type": student_ctx.get("goal_type", "learn_new"),
                "problem_meta": student_ctx.get("problem_meta"),
            }
            strategy = select_strategy(twin, diagnosis, goal, lang)

        # 2) 恢复多轮状态（支持跨轮：由 memory/student_ctx 传入 aocs_state）
        prev_state = student_ctx.get("aocs_state")
        if not isinstance(prev_state, dict):
            prev_state = {
                "turn": 0,
                "hint_level": int(strategy.get("hint_level", 1) or 1),
                "streak_correct": 0,
                "status": ST_DIAGNOSE,
            }

        # 3) 评估本轮作答
        evaluation = evaluate_answer(
            ctx.get("student_answer"), ctx.get("reference"), lang
        )

        # 4) 状态机转移
        out = aocs_transition(prev_state, evaluation, lang)

        # 5) 拼装反馈
        out["feedback"] = build_feedback(out, strategy, lang)

        new_state = {
            "turn": out["turn"],
            "hint_level": out["hint_level"],
            "streak_correct": out["streak_correct"],
            "status": out["status"],
        }

        logger.info(
            "m10 coach: evaluation=%s action=%s status=%s turn=%s hint_level=%s",
            evaluation, out["action"], out["status"], out["turn"], out["hint_level"],
        )

        return {
            "module": self.name,
            "action": "coach",
            "output": {
                "turn": out["turn"],
                "feedback": out["feedback"],
                "hint_level": out["hint_level"],
                "action": out["action"],
                "next_step": out["next_step"],
                "aocs_status": out["status"],
                "strategy_ref": strategy.get("mode", "支架"),
                "aocs_state": new_state,
            },
            "next": "m11_scientific_inquiry",
        }

    def _restore_state(self, ctx: dict) -> dict:
        """从 ctx 恢复 AOCS 多轮状态（支持跨轮：由 memory/student_ctx 传入 aocs_state）。"""
        if not isinstance(ctx, dict):
            return {"turn": 0, "hint_level": 1, "streak_correct": 0, "status": ST_DIAGNOSE}
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}
        prev = student_ctx.get("aocs_state")
        if isinstance(prev, dict):
            return _safe_state(prev)
        return {"turn": 0, "hint_level": 1, "streak_correct": 0, "status": ST_DIAGNOSE}
