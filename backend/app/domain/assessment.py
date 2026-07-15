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

    映射来源（已核验）：雷达轴键即 HPCAS 六维，源自 m14 规范
    ``14_Holistic_Physics_Competency_Assessment_System``（见
    ``app.modules.m14_competency_assessment``），并与 ``models.SIX_RADAR``
    及前端 ``PqRadar`` 指示轴（知识/建模/科学思维/迁移/竞赛/成长）一一对应。
    属 m14 规范意图，非历史命名错位，故雷达轴键保持为 HPCAS 规范名。

    九维 → 六维为「降维」聚合：reasoning / calculation / meta 在六轴 HPCAS
    中没有对应轴，按设计忽略；其余维度映射如下：
      concept             → knowledge           : 概念理解 → 知识掌握
      modeling            → modeling             : 1:1 映射
      experiment          → scientific_thinking  : 实验探究 → 科学思维
      transfer            → transfer             : 1:1 映射
      competition         → competition          : 1:1 映射
      growth              → growth               : 1:1 映射
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


def aggregate_assessment(db: Session, student: "models.Student") -> dict:
    """由学生与最新 Assessment 汇总核心评估视图。

    返回``{"pq", "radar", "growth_curve", "readiness", "weak_concepts",
    "recommendations"}``，供 ``GET /api/students/{id}/assessment``（公开只读
    API）与 ``GET /api/students/{id}/dashboard`` 共享，避免两端内联重复聚合、
    行为分叉。

    - 存在 Assessment 记录时以记录为准；``radar`` 缺失回退 ``twin_to_radar(twin)``，
      ``readiness`` 缺失回退 ``readiness(pq)``。
    - 无记录时由 Student Twin 推导 radar，pq 取六维均值，readiness 由 pq 启发式推导。
    """
    twin = dict(student.twin or {dim: 0.0 for dim in NINE_DIMS})
    record = (
        db.query(models.Assessment)
        .filter(models.Assessment.student_id == student.student_id)
        .order_by(models.Assessment.created_at.desc())
        .first()
    )
    if record is not None:
        pq = record.pq
        radar = record.radar or twin_to_radar(twin)
        growth_curve = record.growth_curve or []
        readiness_val = record.readiness or readiness(pq)
        weak = record.weak_concepts or []
        recs = record.recommendations or []
    else:
        radar = twin_to_radar(twin)
        pq = round(sum(radar.values()) / len(radar), 3) if radar else 0.0
        growth_curve = []
        readiness_val = readiness(pq)
        weak = []
        recs = []
    return {
        "pq": pq,
        "radar": radar,
        "growth_curve": growth_curve,
        "readiness": readiness_val,
        "weak_concepts": weak,
        "recommendations": recs,
    }


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
