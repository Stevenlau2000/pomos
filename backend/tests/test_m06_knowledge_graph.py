"""m06 知识图谱引擎单测：薄弱节点定位 + prerequisite 路径 + 防御式（纯函数 + 集成）。"""
from app.modules.m06_knowledge_graph import (
    KnowledgeGraphModule,
    weak_nodes,
    weak_dim_summary,
)
from app.modules.assessment_engine import NINE_DIMS
from app.data.kg_core import prereq_path, KG_NODES


def _twin(value: float) -> dict:
    return {d: value for d in NINE_DIMS}


def test_weak_nodes_top5_and_prereq_path():
    # 全 0 画像 → 所有节点掌握度=0，top5 中最弱含 newton（带先修 kinematics）
    nodes = weak_nodes(top_n=5, lang="zh", twin=_twin(0.0))
    assert len(nodes) == 5
    assert all(set(n.keys()) >= {"name", "board", "mastery", "difficulty", "prerequisite_path"} for n in nodes)
    # 至少存在一个带非空 prerequisite_path 的节点
    assert any(len(n["prerequisite_path"]) > 0 for n in nodes)


def test_prereq_path_nonempty_for_deep_node():
    # em_induction 先修链：magnetic -> electrostatic, circuit
    path = prereq_path("em_induction")
    assert "magnetic" in path
    assert "circuit" in path
    assert "electrostatic" in path


def test_weak_dim_summary_all_weak_when_zero():
    wd = weak_dim_summary(twin=_twin(0.0))
    assert set(wd) == set(NINE_DIMS)


def test_weak_dim_summary_none_when_full():
    wd = weak_dim_summary(twin=_twin(1.0))
    assert wd == []


def test_run_normal():
    mod = KnowledgeGraphModule()
    twin = _twin(0.0)
    ctx = {"student_id": "s1", "twin": twin, "student_ctx": {"twin": twin}}
    res = mod.run(ctx)
    assert res["module"] == "m06_knowledge_graph"
    out = res["output"]
    assert out["layers"] == 6
    assert out["top_n"] == 5
    assert len(out["nodes"]) == 5
    assert len(out["weak_dim_summary"]) == 9
    assert res["next"] == "m07_physics_thinking"


def test_run_defensive_no_ctx():
    mod = KnowledgeGraphModule()
    res = mod.run({})
    assert isinstance(res["output"], dict)
    assert "nodes" in res["output"]
    assert isinstance(res["output"]["nodes"], list)
