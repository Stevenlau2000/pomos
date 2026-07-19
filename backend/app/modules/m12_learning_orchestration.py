"""POMOS 规范模块 12_Adaptive_Learning_Orchestration_Engine（Teaching 层）。

ALOE：自适应学习编排——排程、复习曲线、路径规划。
- ``priority_score(twin, goal_type, weak_bugs)``：0~100 优先级（薄弱维多 → 高优先级）。
- ``weekly_plan`` / ``daily_plan``：复习节点带 ``interval_day``（取自 EBBINGHAUS_INTERVALS）。
薄弱节点由 twin 关联九维 → KG 节点映射得到。纯规则，不接 LLM；双语。
设计文档见任务分解 T04。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.modules.base import ModuleBase
from app.modules._common import WEAK_THRESHOLD, _lang, safe_twin
from app.modules.assessment_engine import NINE_DIMS
from app.data.kg_core import KG_NODES, NODE_BY_ID, node_mastery

logger = logging.getLogger("pomos.module.m12")

# 艾宾浩斯复习间隔（天）
EBBINGHAUS_INTERVALS: List[int] = [1, 2, 4, 7, 15, 30]


def _weak_node_ids(twin: Optional[Dict[str, float]]) -> List[str]:
    """由 twin 薄弱维映射到最相关的 KG 节点 id（按关联数、重要性排序，取前 5）。

    若无任何薄弱维（全达标），则回退取掌握度最低的 5 个节点，保证计划非空。
    """
    twin = twin or {d: 0.0 for d in NINE_DIMS}
    weak = [d for d in NINE_DIMS if (twin.get(d, 0.0) or 0.0) < WEAK_THRESHOLD]
    if weak:
        scored = []
        for n in KG_NODES:
            overlap = set(n.get("dims") or []) & set(weak)
            if overlap:
                scored.append((n, len(overlap), int(n.get("importance", 3))))
        scored.sort(key=lambda x: (-x[1], -x[2]))
        return [s[0]["id"] for s in scored[:5]]
    # 回退：掌握度最低的节点
    scored = [(n, node_mastery(n, twin)) for n in KG_NODES]
    scored.sort(key=lambda x: x[1])
    return [s[0]["id"] for s in scored[:5]]


def priority_score(
    twin: Optional[Dict[str, float]] = None,
    goal_type: str = "learn_new",
    weak_bugs: Optional[List[str]] = None,
) -> int:
    """学习优先级评分（0~100）。

    规则：薄弱维越多 → 基础分越高；叠加已知错题 weak_bugs；复习目标再加权。
    40 + 12*薄弱维数 + 8*错因数，封顶 100。
    """
    twin = twin or {d: 0.0 for d in NINE_DIMS}
    weak = [d for d in NINE_DIMS if (twin.get(d, 0.0) or 0.0) < WEAK_THRESHOLD]
    n_weak = len(weak)
    n_bugs = len(weak_bugs or [])
    score = 40 + 12 * n_weak + 8 * n_bugs
    if goal_type == "review":
        score += 10
    return int(max(0, min(100, score)))


def weekly_plan(
    twin: Optional[Dict[str, float]] = None,
    lang: str = "zh",
    goal_type: str = "learn_new",
) -> List[Dict[str, Any]]:
    """生成一周复习计划（7 天），每日一复习节点，带 interval_day。"""
    en = (lang or "zh") == "en"
    node_ids = _weak_node_ids(twin)
    plan: List[Dict[str, Any]] = []
    for i in range(7):
        nid = node_ids[i % len(node_ids)] if node_ids else None
        interval = EBBINGHAUS_INTERVALS[i % len(EBBINGHAUS_INTERVALS)]
        node = NODE_BY_ID.get(nid) if nid else None
        title = (f"Review: {node['name']}" if en else f"复习：{node['name']}") if node else (
            "Consolidation practice" if en else "巩固综合练习"
        )
        plan.append({
            "day": i + 1,
            "task": title,
            "interval_day": interval,
            "node_id": nid,
        })
    return plan


def daily_plan(
    twin: Optional[Dict[str, float]] = None,
    lang: str = "zh",
    goal_type: str = "learn_new",
) -> List[Dict[str, Any]]:
    """生成当日计划（含复习/训练/元认知三段），各带 interval_day。"""
    en = (lang or "zh") == "en"
    node_ids = _weak_node_ids(twin)
    nid = node_ids[0] if node_ids else None
    node = NODE_BY_ID.get(nid) if nid else None

    plan: List[Dict[str, Any]] = []
    if node:
        plan.append({
            "slot": "Morning" if en else "早晨",
            "task": (f"Review {node['name']} (weak point)" if en else f"复习 {node['name']}（薄弱点）"),
            "interval_day": EBBINGHAUS_INTERVALS[0],
            "node_id": nid,
        })
    plan.append({
        "slot": "Afternoon" if en else "下午",
        "task": ("New problems + mistake review" if en else "新题训练 + 错题复盘"),
        "interval_day": EBBINGHAUS_INTERVALS[1],
        "node_id": nid,
    })
    plan.append({
        "slot": "Evening" if en else "晚上",
        "task": ("Metacognitive summary: log today's mistakes" if en
                 else "元认知总结：记录今日错因"),
        "interval_day": EBBINGHAUS_INTERVALS[2],
        "node_id": None,
    })
    return plan


class LearningOrchestrationModule(ModuleBase):
    name = "m12_learning_orchestration"
    layer = "Teaching"
    spec = "12_Adaptive_Learning_Orchestration_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：取 twin + goal_type/weak_bugs → 优先级 + 周/日计划 → 标准返回。

        防御式：缺字段绝不抛异常；回退默认 learn_new 与空 twin。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        twin = safe_twin(ctx)
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}
        goal_type = student_ctx.get("goal_type") if isinstance(student_ctx, dict) else None
        goal_type = goal_type or "learn_new"
        weak_bugs = student_ctx.get("weak_bugs") if isinstance(student_ctx, dict) else None

        score = priority_score(twin, goal_type, weak_bugs)
        wp = weekly_plan(twin, lang, goal_type)
        dp = daily_plan(twin, lang, goal_type)

        logger.info("m12 learning: priority=%d weekly=%d daily=%d", score, len(wp), len(dp))
        return {
            "module": self.name,
            "action": "plan_path",
            "output": {
                "weekly_plan": wp,
                "daily_plan": dp,
                "priority_score": score,
            },
            "next": "m13_memory_os",
        }
