"""POMOS 知识库核心（Knowledge Graph 静态数据 + 工具）。

提供：
- ``KG_BOARDS``：五大物理板块。
- ``KG_NODES``：≥12 个概念级节点，每个含 id/name/board/dims(关联九维)/difficulty(1-5)/
  importance(1-5)/prerequisites(节点 id 列表)。板块取值与前端 ``KG_NODES`` 保持一致。
- ``KG_LINKS``：prerequisite / transfer 关系边（source/target/relation）。
- ``prereq_path(node_id)``：沿 prerequisites 回溯的完整先修路径（祖先节点 id 列表）。
- ``node_mastery(node, twin)``：按 twin 计算单节点掌握度（0~100）。

纯数据 + 纯函数，无外部依赖，可离线 pytest。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.modules.assessment_engine import NINE_DIMS

# 五大板块（与前端 frontend/lib/pomosData.ts 的 KG_NODES.board 对齐）
KG_BOARDS: List[str] = ["力学", "电磁学", "热学", "光学", "近代物理"]

# 概念级节点（≥12）。dims 关联九维键；prerequisites 指向其它节点 id。
KG_NODES: List[Dict[str, Any]] = [
    {
        "id": "kinematics", "name": "运动学", "board": "力学",
        "dims": ["modeling", "calculation"], "difficulty": 2, "importance": 4,
        "prerequisites": [],
    },
    {
        "id": "newton", "name": "牛顿定律", "board": "力学",
        "dims": ["concept", "modeling", "reasoning"], "difficulty": 3, "importance": 5,
        "prerequisites": ["kinematics"],
    },
    {
        "id": "energy", "name": "能量守恒", "board": "力学",
        "dims": ["concept", "reasoning"], "difficulty": 3, "importance": 5,
        "prerequisites": ["newton"],
    },
    {
        "id": "momentum", "name": "动量守恒", "board": "力学",
        "dims": ["reasoning", "modeling"], "difficulty": 3, "importance": 4,
        "prerequisites": ["newton"],
    },
    {
        "id": "rotation", "name": "刚体转动", "board": "力学",
        "dims": ["modeling", "calculation"], "difficulty": 4, "importance": 5,
        "prerequisites": ["newton", "energy"],
    },
    {
        "id": "oscillation", "name": "振动与波", "board": "力学",
        "dims": ["modeling", "concept"], "difficulty": 3, "importance": 4,
        "prerequisites": ["energy", "kinematics"],
    },
    {
        "id": "electrostatic", "name": "静电场", "board": "电磁学",
        "dims": ["concept", "modeling"], "difficulty": 3, "importance": 4,
        "prerequisites": [],
    },
    {
        "id": "circuit", "name": "恒定电流", "board": "电磁学",
        "dims": ["calculation", "concept"], "difficulty": 2, "importance": 4,
        "prerequisites": ["electrostatic"],
    },
    {
        "id": "magnetic", "name": "磁场", "board": "电磁学",
        "dims": ["concept", "reasoning"], "difficulty": 4, "importance": 5,
        "prerequisites": ["electrostatic"],
    },
    {
        "id": "em_induction", "name": "电磁感应", "board": "电磁学",
        "dims": ["concept", "modeling", "reasoning"], "difficulty": 5, "importance": 5,
        "prerequisites": ["magnetic", "circuit"],
    },
    {
        "id": "thermo", "name": "热学", "board": "热学",
        "dims": ["concept", "calculation"], "difficulty": 3, "importance": 3,
        "prerequisites": ["energy"],
    },
    {
        "id": "wave", "name": "机械波与光波", "board": "光学",
        "dims": ["modeling", "concept"], "difficulty": 3, "importance": 4,
        "prerequisites": ["oscillation"],
    },
    {
        "id": "optics", "name": "光学", "board": "光学",
        "dims": ["modeling", "reasoning"], "difficulty": 3, "importance": 3,
        "prerequisites": ["wave"],
    },
    {
        "id": "modern", "name": "近代物理", "board": "近代物理",
        "dims": ["concept", "reasoning"], "difficulty": 4, "importance": 4,
        "prerequisites": [],
    },
]

# id -> node 索引（O(1) 查询）
_NODE_BY_ID: Dict[str, Dict[str, Any]] = {n["id"]: n for n in KG_NODES}
# 公开别名（供模块按 id 取节点名，避免依赖私有名）
NODE_BY_ID: Dict[str, Dict[str, Any]] = _NODE_BY_ID

# 关系边：prerequisite（先修）+ transfer（迁移/关联）
KG_LINKS: List[Dict[str, str]] = []
for _n in KG_NODES:
    for _p in _n.get("prerequisites") or []:
        KG_LINKS.append({"source": _p, "target": _n["id"], "relation": "prerequisite"})
KG_LINKS += [
    {"source": "energy", "target": "thermo", "relation": "transfer"},
    {"source": "oscillation", "target": "wave", "relation": "transfer"},
    {"source": "magnetic", "target": "em_induction", "relation": "transfer"},
    {"source": "newton", "target": "rotation", "relation": "transfer"},
    {"source": "electrostatic", "target": "circuit", "relation": "transfer"},
]


def node_mastery(node: Dict[str, Any], twin: Optional[Dict[str, float]]) -> float:
    """按 twin 计算单节点掌握度（0~100）。

    - 节点 ``dims`` 非空：取所关联九维的均值 * 100。
    - 节点 ``dims`` 为空：回退用 ``importance`` 归一（importance/5*100）。
    twin 缺失时按全 0 处理。
    """
    twin = twin or {d: 0.0 for d in NINE_DIMS}
    dims = node.get("dims") or []
    if dims:
        vals = [float(twin.get(d, 0.0) or 0.0) for d in dims]
        return round(sum(vals) / max(1, len(vals)) * 100, 1)
    return round((float(node.get("importance", 3)) / 5.0) * 100, 1)


def prereq_path(node_id: str) -> List[str]:
    """沿 prerequisites 回溯的完整先修路径（祖先节点 id 列表，去重、广度优先序）。

    node_id 不存在或节点无先修时返回空列表（安全，不抛异常）。
    """
    try:
        node = _NODE_BY_ID.get(node_id)
        if node is None:
            return []
        visited: List[str] = []
        seen: set[str] = set()
        stack = list(node.get("prerequisites") or [])
        while stack:
            nid = stack.pop(0)
            if nid in seen:
                continue
            seen.add(nid)
            visited.append(nid)
            parent = _NODE_BY_ID.get(nid)
            if parent:
                stack.extend(parent.get("prerequisites") or [])
        return visited
    except Exception:
        return []
