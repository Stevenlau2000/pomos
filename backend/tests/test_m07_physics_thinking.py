"""m07 物理思维管线单测：十阶段 + 每阶段 status/hint 非空 + 防御式（纯函数 + 集成）。"""
from app.modules.m07_physics_thinking import (
    PhysicsThinkingModule,
    trace_thinking,
)
from app.modules.assessment_engine import NINE_DIMS


def _twin(value: float) -> dict:
    return {d: value for d in NINE_DIMS}


def test_trace_thinking_ten_stages_nonempty():
    trace = trace_thinking("一个带电粒子在磁场中做圆周运动，求半径", _twin(0.2), "zh")
    assert trace["stage_count"] == 10
    assert len(trace["stages"]) == 10
    for st in trace["stages"]:
        assert set(st.keys()) >= {"stage_no", "name", "status", "hint"}
        assert st["status"] in ("pending", "active", "done")
        assert isinstance(st["hint"], str) and len(st["hint"]) > 0
        assert isinstance(st["name"], str) and len(st["name"]) > 0
    # 第一阶段为 active
    assert trace["stages"][0]["status"] == "active"


def test_trace_thinking_en():
    trace = trace_thinking("a charged particle in magnetic field", _twin(0.2), "en")
    assert trace["stage_count"] == 10
    assert "Problem Representation" in trace["stages"][0]["name"]


def test_run_normal():
    mod = PhysicsThinkingModule()
    ctx = {
        "student_id": "s1",
        "message": "电磁感应中导体棒切割磁感线求电动势",
        "twin": _twin(0.2),
        "student_ctx": {"twin": _twin(0.2)},
    }
    res = mod.run(ctx)
    assert res["module"] == "m07_physics_thinking"
    out = res["output"]
    assert out["stage_count"] == 10
    assert len(out["stages"]) == 10
    assert all(st["status"] and st["hint"] for st in out["stages"])
    assert res["next"] == "m08_teaching_strategy"


def test_run_defensive_no_ctx():
    mod = PhysicsThinkingModule()
    res = mod.run({})
    assert res["module"] == "m07_physics_thinking"
    assert len(res["output"]["stages"]) == 10
