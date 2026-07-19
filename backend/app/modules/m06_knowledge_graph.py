"""POMOS 规范模块 06_Knowledge_Graph_Engine（Knowledge 层）。

六层知识图谱引擎：内置知识库（app.data.kg_core）+ 按 twin 薄弱维定位 top-N 节点
及其 prerequisite 路径。纯规则实装，不接 LLM；双语。
设计文档见任务分解 T03。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.modules.base import ModuleBase
from app.modules._common import WEAK_THRESHOLD, _lang, safe_twin
from app.modules.assessment_engine import NINE_DIMS
from app.data.kg_core import (
    KG_NODES,
    NODE_BY_ID,
    node_mastery,
    prereq_path,
)

logger = logging.getLogger("pomos.module.m06")


def weak_nodes(
    top_n: int = 5,
    lang: str = "zh",
    board: Optional[str] = None,
    twin: Optional[Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    """返回薄弱节点列表（按掌握度升序取 top_n，附 prerequisite 路径）。

    - 节点掌握度由 ``node_mastery`` 计算（twin 关联维均值 * 100）。
    - 可指定 ``board`` 过滤板块。
    - 每个节点含 name / board / mastery / difficulty / prerequisite_path（先修节点名列表）。
    """
    twin = twin or {d: 0.0 for d in NINE_DIMS}
    en = (lang or "zh") == "en"
    candidates = [n for n in KG_NODES if board is None or n.get("board") == board]
    scored = [(n, node_mastery(n, twin)) for n in candidates]
    # 掌握度升序：越弱排越前
    scored.sort(key=lambda x: x[1])
    top = scored[: max(0, int(top_n))]
    out: List[Dict[str, Any]] = []
    for n, m in top:
        path_ids = prereq_path(n["id"])
        path_names = [(NODE_BY_ID.get(p) or {}).get("name", p) for p in path_ids]
        out.append({
            "id": n["id"],
            "name": n["name"],
            "board": n["board"],
            "mastery": m,
            "difficulty": n["difficulty"],
            "prerequisite_path": path_names,
        })
    return out


def weak_dim_summary(
    twin: Optional[Dict[str, float]] = None,
    lang: str = "zh",
) -> List[str]:
    """返回 twin 中低于薄弱阈值的维度列表（保持 NINE_DIMS 顺序）。"""
    twin = twin or {d: 0.0 for d in NINE_DIMS}
    return [d for d in NINE_DIMS if (twin.get(d, 0.0) or 0.0) < WEAK_THRESHOLD]


class KnowledgeGraphModule(ModuleBase):
    name = "m06_knowledge_graph"
    layer = "Knowledge"
    spec = "06_Knowledge_Graph_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：取 safe_twin → weak_nodes + weak_dim_summary → 标准返回。

        防御式：缺字段绝不抛异常；board 优先读 student_ctx。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        twin = safe_twin(ctx)
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}
        board = student_ctx.get("board") if isinstance(student_ctx, dict) else None
        board = board if isinstance(board, str) else None

        top_n = 5
        nodes = weak_nodes(top_n=top_n, lang=lang, board=board, twin=twin)
        wd = weak_dim_summary(twin=twin, lang=lang)

        logger.info(
            "m06 kg: weak_nodes=%d weak_dims=%d", len(nodes), len(wd)
        )
        return {
            "module": self.name,
            "action": "query_kg",
            "output": {
                "nodes": nodes,
                "layers": 6,
                "top_n": top_n,
                "weak_dim_summary": wd,
            },
            "next": "m07_physics_thinking",
        }
