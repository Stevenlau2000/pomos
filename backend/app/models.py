"""ORM 数据模型：Student / Message / Assessment。

对应 POMOS 规范中学生画像（九维 Student Twin）、对话记录与能力评估（HPCAS/PQ）。
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, DateTime, Text, JSON

from app.database import Base


def _utcnow() -> datetime:
    """返回带时区的当前 UTC 时间。"""
    return datetime.now(timezone.utc)


# 04_Student_Modeling_Engine：九维 Student Twin 维度键
NINE_DIMS: list[str] = [
    "concept",          # 概念理解
    "modeling",         # 建模能力
    "reasoning",        # 推理能力
    "calculation",      # 计算能力
    "experiment",       # 实验探究
    "transfer",         # 迁移能力
    "meta",             # 元认知
    "competition",      # 竞赛素养
    "growth",           # 成长态势
]

# 14_HPCAS 雷达图六维
SIX_RADAR: list[str] = [
    "knowledge",
    "modeling",
    "scientific_thinking",
    "transfer",
    "competition",
    "growth",
]

# 九维 Student Twin 展示元信息（标签 + 解读提示），供前端数字孪生视图直接渲染
NINE_DIM_META: dict[str, dict] = {
    "concept": {"label": "概念理解", "hint": "对物理概念与本质的掌握程度"},
    "modeling": {"label": "建模能力", "hint": "将现实情境抽象为物理模型"},
    "reasoning": {"label": "推理能力", "hint": "因果演绎与逻辑链完整性"},
    "calculation": {"label": "计算能力", "hint": "数学求解与数值处理规范"},
    "experiment": {"label": "实验探究", "hint": "实验设计与误差分析"},
    "transfer": {"label": "迁移能力", "hint": "跨情境类比与综合应用"},
    "meta": {"label": "元认知", "hint": "自我监控与错题反思"},
    "competition": {"label": "竞赛素养", "hint": "竞赛策略与压轴题经验"},
    "growth": {"label": "成长态势", "hint": "持续训练与提升趋势"},
}

# 知识图谱五大板块 -> 九维映射（用于由 twin 推导各板块掌握度着色）
BOARD_MASTERY_MAP: dict[str, list[str]] = {
    "力学": ["concept", "modeling", "reasoning"],
    "电磁学": ["modeling", "calculation", "concept"],
    "热学": ["concept", "calculation"],
    "光学": ["concept", "modeling"],
    "近代物理": ["concept", "transfer"],
}


def _default_twin() -> dict:
    """新建学生时初始化九维掌握度全为 0.0。"""
    return {dim: 0.0 for dim in NINE_DIMS}


class Student(Base):
    """学生表：含身份信息与九维 Student Twin 快照。"""

    __tablename__ = "students"

    student_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    grade = Column(String, nullable=True)  # 年级，如 "高一"
    created_at = Column(DateTime, default=_utcnow)
    deleted_at = Column(DateTime, nullable=True)  # 软删除时间戳
    # 九维 Student Twin（0.0 ~ 1.0）
    twin = Column(JSON, default=_default_twin)


class Message(Base):
    """消息表：用于持久化师生多轮对话。"""

    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" | "assistant"
    content = Column(Text)
    created_at = Column(DateTime, default=_utcnow)


class Assessment(Base):
    """评估表：存储 HPCAS 综合物理能力评估（PQ 等）。"""

    __tablename__ = "assessments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, index=True)
    pq = Column(Float, default=0.0)  # 物理素养综合分 Physics Quotient
    radar = Column(JSON, default=lambda: {k: 0.0 for k in SIX_RADAR})
    growth_curve = Column(JSON, default=list)  # [{ts, pq}]
    readiness = Column(JSON, default=lambda: {
        "province_top": 0.0,
        "province_team": 0.0,
        "ipho": 0.0,
    })
    # 最新一轮评估检测到的错误概念与训练建议（来自评估引擎）
    weak_concepts = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)


class Mistake(Base):
    """错题本：记录学生的错误概念与归因，供复盘与变式训练。"""

    __tablename__ = "mistakes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, index=True)
    topic = Column(String)  # 主题，如「电磁感应·导体棒切割」
    summary = Column(Text)  # 错误摘要
    bug_id = Column(String, nullable=True)  # 关联认知 Bug id（可选）
    status = Column(String, default="未掌握")  # 未掌握 / 巩固中 / 已掌握
    recurrence = Column(JSON, default=list)  # 复发记录（每次复现追加时间戳）
    created_at = Column(DateTime, default=_utcnow)
    resolved_at = Column(DateTime, nullable=True)
    # 多模态：题目原图（相对 URL，如 /uploads/xxx.png）与解析文本
    image_path = Column(String, nullable=True)
    analysis = Column(Text, nullable=True)  # 题目解析 / 正确思路
