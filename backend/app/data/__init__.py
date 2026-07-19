"""POMOS 静态数据聚合层（知识库 / 题库 / 实验模板）。

统一再导出，便于模块以 ``from app.data import KG_NODES, PROBLEM_BANK, ...`` 方式引用。
"""
from __future__ import annotations

from app.data.kg_core import (
    KG_BOARDS,
    KG_LINKS,
    KG_NODES,
    NODE_BY_ID,
    node_mastery,
    prereq_path,
)
from app.data.problem_bank import PROBLEM_BANK
from app.data.inquiry_templates import INQUIRY_TEMPLATES

__all__ = [
    "KG_BOARDS",
    "KG_NODES",
    "KG_LINKS",
    "NODE_BY_ID",
    "node_mastery",
    "prereq_path",
    "PROBLEM_BANK",
    "INQUIRY_TEMPLATES",
]
