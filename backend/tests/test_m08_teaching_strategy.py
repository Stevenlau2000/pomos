"""m08 教学策略引擎单测：六模式路由 + 五级 Hint + 策略装配（纯函数 + 集成）。

不依赖 fixture，直接 import 模块函数离线运行。
"""
from app.modules.m08_teaching_strategy import (
    TeachingStrategyModule,
    generate_hint,
    initial_hint_level,
    route_mode,
    select_strategy,
)
from app.modules.assessment_engine import NINE_DIMS


# ---------------- route_mode 各优先级分支 ----------------
def test_route_mode_misconception_first():
    # 优先级 1：顽固错误概念 → 讲授（高于一切）
    sig = {"has_misconception": True, "weak_dims": ["calculation"],
            "goal_type": "review", "recent_practice": True, "avg_mastery": 0.9}
    assert route_mode(sig) == "讲授"


def test_route_mode_inquiry():
    # 优先级 2：新学 + concept 弱 → 探究
    sig = {"has_misconception": False, "weak_dims": ["concept"],
            "goal_type": "learn_new", "recent_practice": False, "avg_mastery": 0.3}
    assert route_mode(sig) == "探究"


def test_route_mode_scaffold_new_other_weak():
    # 优先级 3：新学 + 其它弱维（非 concept/modeling）→ 支架
    sig = {"has_misconception": False, "weak_dims": ["calculation"],
            "goal_type": "learn_new", "recent_practice": False, "avg_mastery": 0.3}
    assert route_mode(sig) == "支架"


def test_route_mode_drill():
    # 优先级 4：巩固 + 均值够高 → 对练
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "consolidate", "recent_practice": False, "avg_mastery": 0.7}
    assert route_mode(sig) == "对练"


def test_route_mode_review():
    # 优先级 5a：复习 → 复盘
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "review", "recent_practice": False, "avg_mastery": 0.5}
    assert route_mode(sig) == "复盘"


def test_route_mode_recent_practice():
    # 优先级 5b：近期练过 → 复盘
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "learn_new", "recent_practice": True, "avg_mastery": 0.5}
    assert route_mode(sig) == "复盘"


def test_route_mode_extend():
    # 优先级 6a：拓展 → 拓展
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "extend", "recent_practice": False, "avg_mastery": 0.5}
    assert route_mode(sig) == "拓展"


def test_route_mode_high_mastery_extend():
    # 优先级 6b：均值很高 → 拓展
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "learn_new", "recent_practice": False, "avg_mastery": 0.9}
    assert route_mode(sig) == "拓展"


def test_route_mode_default():
    # 默认：apply + 低均值 + 无弱维（理论不会，但防御）→ 支架
    sig = {"has_misconception": False, "weak_dims": [],
            "goal_type": "apply", "recent_practice": False, "avg_mastery": 0.4}
    assert route_mode(sig) == "支架"


# ---------------- initial_hint_level 边界 1 / 5 ----------------
def _twin(value: float) -> dict:
    return {d: value for d in NINE_DIMS}


def test_initial_hint_level_min_1():
    # 难度 1 + 满级掌握 → base=round(1-4)=-3 → 封底 1；无错误概念
    lvl = initial_hint_level(_twin(1.0), [], {"difficulty": 1})
    assert lvl == 1


def test_initial_hint_level_max_5():
    # 难度 5 + 零掌握 → base=5；无错误概念仍是 5
    lvl = initial_hint_level(_twin(0.0), [], {"difficulty": 5})
    assert lvl == 5


def test_initial_hint_level_misconception_bumps():
    # 有错误概念时 +1（封顶 5）
    lvl = initial_hint_level(_twin(0.0), [{"dims": ["reasoning"]}], {"difficulty": 5})
    assert lvl == 5


def test_initial_hint_level_mid():
    # 难度 3 + 均值 0 → base=3；无错误概念
    lvl = initial_hint_level(_twin(0.0), [], {"difficulty": 3})
    assert lvl == 3


# ---------------- generate_hint 五个 level 均非空 ----------------
def test_generate_hint_all_levels_zh():
    for lvl in (1, 2, 3, 4, 5):
        h = generate_hint(lvl, None, "zh")
        assert isinstance(h, str) and len(h) > 0


def test_generate_hint_all_levels_en():
    for lvl in (1, 2, 3, 4, 5):
        h = generate_hint(lvl, None, "en")
        assert isinstance(h, str) and len(h) > 0


def test_generate_hint_em_board_l3():
    h = generate_hint(3, {"board": "电磁学", "difficulty": 5}, "zh")
    assert "ε=BLv" in h


# ---------------- select_strategy 返回结构 ----------------
def test_select_strategy_structure():
    twin = _twin(0.3)
    diagnosis = []
    goal = {"goal_type": "learn_new", "problem_meta": {"difficulty": 4}}
    s = select_strategy(twin, diagnosis, goal, "zh")
    assert set(s.keys()) >= {"mode", "hint_level", "rationale", "target_dims", "scaffolding"}
    assert s["mode"] in {"讲授", "探究", "支架", "对练", "复盘", "拓展"}
    assert 1 <= s["hint_level"] <= 5
    assert isinstance(s["rationale"], str) and len(s["rationale"]) > 0
    assert isinstance(s["target_dims"], list)


def test_select_strategy_misconception_scaffolding():
    twin = _twin(0.3)
    diagnosis = [{"dims": ["reasoning", "concept"], "note": "x"}]
    goal = {"goal_type": "apply"}
    s = select_strategy(twin, diagnosis, goal, "zh")
    assert s["mode"] == "讲授"
    assert isinstance(s["scaffolding"], str) and len(s["scaffolding"]) > 0
    assert "reasoning" in s["target_dims"]


def test_select_strategy_en_rationale():
    twin = _twin(0.7)
    s = select_strategy(twin, [], {"goal_type": "extend"}, "en")
    assert "Mode=" in s["rationale"]


# ---------------- _infer_goal 关键词映射 ----------------
def _mk_mod() -> TeachingStrategyModule:
    return TeachingStrategyModule()


def test_infer_goal_keywords():
    mod = _mk_mod()
    assert mod._infer_goal({"message": "帮我复习一下能量守恒"})["goal_type"] == "review"
    assert mod._infer_goal({"message": "来道拓展压轴题"})["goal_type"] == "extend"
    assert mod._infer_goal({"message": "刷几道题巩固"})["goal_type"] == "consolidate"
    assert mod._infer_goal({"message": "应用动能定理做一下"})["goal_type"] == "apply"
    assert mod._infer_goal({"message": "讲讲牛顿第二定律"})["goal_type"] == "learn_new"


def test_infer_goal_problem_meta_from_student_ctx():
    mod = _mk_mod()
    pm = {"board": "力学", "difficulty": 3}
    g = mod._infer_goal({"message": "x", "student_ctx": {"problem_meta": pm}})
    assert g["problem_meta"] == pm


# ---------------- 集成：m08.run(ctx) 返回标准 dict ----------------
def test_run_standard_output():
    mod = _mk_mod()
    twin = _twin(0.2)
    ctx = {
        "student_id": "s1",
        "session_id": "sess1",
        "message": "我想新学电磁感应，概念还不太清楚",
        "student_ctx": {"twin": twin},
        "twin": twin,
    }
    res = mod.run(ctx)
    assert res["module"] == "m08_teaching_strategy"
    assert res["action"] == "select_strategy"
    out = res["output"]
    assert set(out.keys()) >= {"mode", "hint_level", "rationale", "target_dims", "scaffolding"}
    assert res["next"] == "m09_olympiad_problem"
    assert 1 <= out["hint_level"] <= 5


def test_run_defensive_no_ctx():
    mod = _mk_mod()
    # 缺字段绝不抛异常，回退默认
    res = mod.run({})
    assert res["module"] == "m08_teaching_strategy"
    assert "mode" in res["output"]
    assert "hint_level" in res["output"]
