"""POMOS 训练编排引擎（10_AOCS / 12_ALOE 的实质性实现）。

由学生九维画像 + 评估引擎检测到的错误概念 + 建议，推导个性化训练计划：
- 周计划（AOCS 周期）：按最弱维度与误区轮换聚焦；
- 今日规划（ALOE 优先级）：按缺口大小给任务排优先级与时间。

完全离线可用（确定性启发式），无需任何 LLM 密钥。
"""
from __future__ import annotations

from typing import Any, Dict, List

from app.models import NINE_DIMS

# 各维度专项训练焦点命名（AOCS 周聚焦）
FOCUS_NAME: Dict[str, str] = {
    "concept": "概念巩固与物理意义复述",
    "modeling": "建模三步走专项（变量→方程→边界）",
    "reasoning": "因果推理训练（因为…所以…）",
    "calculation": "计算规范化（矢量/单位/符号）",
    "experiment": "实验探究与误差分析",
    "transfer": "跨板块迁移综合题",
    "meta": "错题反思与元认知复盘",
    "competition": "近三年真题限时训练",
    "growth": "稳定周训练量跟踪",
}

# 默认 4 周通用主题（数据不足时兜底）
GENERIC_WEEKS: List[str] = [
    "力学综合强化",
    "电磁学突破（感应）",
    "跨板块综合",
    "模拟赛与查漏",
]

TYPE_BY_INDEX = ["复习", "新学", "训练", "实验"]
TIMES = ["19:00", "19:45", "20:30", "21:10"]


def _short(note: str) -> str:
    """取错误概念说明的前 18 字作为聚焦标题。"""
    return note[:18] + ("…" if len(note) > 18 else "")


def build_training_plan(
    twin: Dict[str, float],
    weak_concepts: List[str],
    recommendations: List[str],
) -> Dict[str, Any]:
    """由画像与评估产出个性化训练计划。

    Returns:
        ``{"weekly": [...], "today": [...], "rationale": str}``
    """
    t = {d: float(twin.get(d, 0.0)) for d in NINE_DIMS}

    # 最弱维度（升序取前 3）
    weak_dims = sorted(NINE_DIMS, key=lambda d: t[d])[:3]

    # 聚焦序列：误区优先，其次最弱维度
    focuses: List[str] = []
    if weak_concepts:
        focuses.append(f"误区复盘：{_short(weak_concepts[0])}")
    for d in weak_dims:
        focuses.append(FOCUS_NAME.get(d, d))
    if not focuses:
        focuses = GENERIC_WEEKS[:]
    focuses = focuses[:4]

    # 周计划（4 周，聚焦轮换）
    weekly: List[Dict[str, Any]] = []
    for i in range(4):
        focus = focuses[i % len(focuses)]
        items = [
            f"{focus}（核心 6 题）",
            "错题本复盘 3 题" if (i % 2 == 1) else "限时模考 1 套",
        ]
        if weak_concepts and i == 0:
            items.append(f"变式训练：{_short(weak_concepts[0])}")
        # 负荷：越弱越高
        base = 60 + int((1 - min(t[weak_dims[0]], 1.0)) * 35) if weak_dims else 70
        load = min(100, base + i * 4)
        weekly.append({
            "week": i + 1,
            "focus": focus,
            "items": items,
            "load": load,
        })

    # 今日规划（ALOE 优先级）：缺口越大优先级越高
    today: List[Dict[str, Any]] = []
    ranked = sorted(NINE_DIMS, key=lambda d: t[d])[:3]
    idx = 0
    if weak_concepts:
        today.append({
            "time": TIMES[0],
            "task": f"复盘误区：{_short(weak_concepts[0])} + 变式 2 题",
            "type": "复习",
            "priority": 95,
        })
        idx = 1
    for d in ranked:
        if idx >= len(TIMES):
            break
        gap = int((1 - min(t[d], 1.0)) * 100)
        today.append({
            "time": TIMES[idx],
            "task": f"{FOCUS_NAME.get(d, d)}（3 题）",
            "type": TYPE_BY_INDEX[idx % len(TYPE_BY_INDEX)],
            "priority": max(50, min(95, 70 + gap // 3)),
        })
        idx += 1
    # 兜底：至少一条
    if not today:
        today.append({
            "time": TIMES[0],
            "task": "综合模考 1 套 + 错题归因",
            "type": "训练",
            "priority": 70,
        })

    rationale = (
        f"基于当前画像：最弱维度为「{FOCUS_NAME.get(weak_dims[0], weak_dims[0]) if weak_dims else '—'}」"
        + (f"；检测到 {len(weak_concepts)} 个误区。" if weak_concepts else "；暂未检测到明显误区。")
        + " 计划已按缺口自动排优先级。"
    )

    return {"weekly": weekly, "today": today, "rationale": rationale}
