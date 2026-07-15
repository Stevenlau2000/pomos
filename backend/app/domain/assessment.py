"""领域服务：能力评估相关业务逻辑。

集中管理原本散落在 chat.py 与 students.py 中的重复计算：
- twin_to_radar    : 九维 Student Twin → 六维 HPCAS 雷达图
- readiness        : 由 PQ 推导省队/国家队就绪度
- board_mastery    : 由 twin 推导各板块掌握度（知识图谱着色）
- apply_student_update : 将编排结果累加到 Student 画像并 upsert Assessment
"""
from __future__ import annotations

import time
from typing import Optional

from sqlalchemy.orm import Session

from app import models
from app.models import BOARD_MASTERY_MAP, SIX_RADAR, NINE_DIMS


# growth_curve 最多保留的采样点数（防止长生命周期下 Assessment 行无限膨胀）
GROWTH_CURVE_MAX = 200


def twin_to_radar(twin: dict) -> dict:
    """九维 Student Twin -> 六维 HPCAS 雷达图。

    映射说明（radar 命名错位修正——添加自解释注释）：
      concept       → knowledge           : 概念理解 → 知识掌握
      modeling      → modeling             : 1:1 映射
      experiment    → scientific_thinking  : 实验探究 → 科学思维
      transfer      → transfer             : 1:1 映射
      competition   → competition          : 1:1 映射
      growth        → growth               : 1:1 映射
    """
    return {
        "knowledge": twin.get("concept", 0.0),
        "modeling": twin.get("modeling", 0.0),
        "scientific_thinking": twin.get("experiment", 0.0),
        "transfer": twin.get("transfer", 0.0),
        "competition": twin.get("competition", 0.0),
        "growth": twin.get("growth", 0.0),
    }


def readiness(pq: float) -> dict:
    """由 PQ 推导省队/国家队的就绪度估算（启发式，0~1）。"""
    return {
        "province_top": round(min(1.0, pq), 3),
        "province_team": round(min(1.0, max(0.0, pq - 0.15)), 3),
        "ipho": round(min(1.0, max(0.0, pq - 0.35)), 3),
    }


def board_mastery(
    twin: dict,
    board_map: Optional[dict[str, list[str]]] = None,
) -> dict[str, float]:
    """由 twin 推导各板块掌握度（知识图谱着色用）。

    Args:
        twin: 九维 Student Twin dict（key = NINE_DIMS, value = 0~1）。
        board_map: 板块→九维子集映射，默认 BOARD_MASTERY_MAP。

    Returns:
        {板块名: 平均掌握度}，如 {"力学": 0.723, ...}。
    """
    mapping = board_map if board_map is not None else BOARD_MASTERY_MAP
    result: dict[str, float] = {}
    for board, dims in mapping.items():
        vals = [float(twin.get(d, 0.0)) for d in dims]
        result[board] = round(sum(vals) / len(vals), 3) if vals else 0.0
    return result


def apply_student_update(
    db: Session,
    student_id: str,
    update: dict,
) -> None:
    """将 student_update 累加到九维画像并 upsert Assessment。

    此函数直接操作数据库，供 chat.py 的 /chat 和 /chat/stream 端点调用，
    闭合「自适应学习循环」——对话后画像与评估自动演进。
    """
    if not update:
        return
    student = db.get(models.Student, student_id)
    if student is None:
        return
    twin = dict(student.twin or {dim: 0.0 for dim in NINE_DIMS})
    for dim, delta in (update.get("mastery_delta") or {}).items():
        if dim in twin:
            twin[dim] = round(min(1.0, max(0.0, twin[dim] + float(delta))), 3)
    student.twin = twin

    pq = float(update.get("pq", 0.0))
    rec = (
        db.query(models.Assessment)
        .filter(models.Assessment.student_id == student_id)
        .order_by(models.Assessment.created_at.desc())
        .first()
    )
    if rec is None:
        rec = models.Assessment(student_id=student_id)
        db.add(rec)
    rec.pq = pq
    rec.radar = twin_to_radar(twin)
    curve = (rec.growth_curve or []) + [{"ts": int(time.time()), "pq": pq}]
    rec.growth_curve = curve[-GROWTH_CURVE_MAX:]  # 限长，仅保留最近采样
    rec.readiness = readiness(pq)
    rec.weak_concepts = (update.get("weak_concepts") or [])[:5]
    rec.recommendations = (update.get("recommendations") or [])[:5]
