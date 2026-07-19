"""m12 学习编排单测：周/日计划(含 interval_day) + 优先级 + 防御式。"""
from app.modules.m12_learning_orchestration import (
    LearningOrchestrationModule,
    daily_plan,
    priority_score,
    weekly_plan,
)
from app.modules.assessment_engine import NINE_DIMS


def _twin(value: float) -> dict:
    return {d: value for d in NINE_DIMS}


def test_priority_score_more_weak_higher():
    # 2 个薄弱维 vs 9 个薄弱维：薄弱维越多优先级越高
    few_weak = {d: (0.1 if i < 2 else 0.8) for i, d in enumerate(NINE_DIMS)}
    many_weak = _twin(0.1)  # 全部 9 维薄弱
    low = priority_score(few_weak, "learn_new", None)
    high = priority_score(many_weak, "learn_new", None)
    assert 0 <= low <= 100 and 0 <= high <= 100
    assert high > low  # 薄弱维多 → 优先级高


def test_priority_score_bugs_boost():
    base = _twin(0.8)  # 无薄弱维
    low = priority_score(base, "learn_new", None)
    high = priority_score(base, "learn_new", ["bug1", "bug2", "bug3"])
    assert high > low  # 错因数提升优先级


def test_weekly_plan_interval_day():
    wp = weekly_plan(_twin(0.2), "zh", "learn_new")
    assert len(wp) == 7
    for item in wp:
        assert "interval_day" in item
        assert isinstance(item["interval_day"], int)


def test_daily_plan_interval_day():
    dp = daily_plan(_twin(0.2), "zh", "learn_new")
    assert len(dp) >= 1
    for item in dp:
        assert "interval_day" in item


def test_run_normal():
    mod = LearningOrchestrationModule()
    twin = {d: (0.2 if d in ("concept", "modeling") else 0.8) for d in NINE_DIMS}
    ctx = {
        "student_id": "s1",
        "twin": twin,
        "student_ctx": {"twin": twin, "goal_type": "review", "weak_bugs": ["b1"]},
    }
    res = mod.run(ctx)
    assert res["module"] == "m12_learning_orchestration"
    out = res["output"]
    assert "weekly_plan" in out and "daily_plan" in out and "priority_score" in out
    assert all("interval_day" in item for item in out["weekly_plan"])
    assert all("interval_day" in item for item in out["daily_plan"])
    assert isinstance(out["priority_score"], int)
    assert res["next"] == "m13_memory_os"


def test_run_defensive_no_ctx():
    mod = LearningOrchestrationModule()
    res = mod.run({})
    assert isinstance(res["output"], dict)
    assert "weekly_plan" in res["output"]
    assert "daily_plan" in res["output"]
    assert "priority_score" in res["output"]
