"""m10 AOCS 自适应教练单测：状态机收敛 + 作答评估 + 反馈拼装（纯函数 + 集成）。

不依赖 fixture，直接 import 模块函数离线运行。
"""
from app.modules.m10_olympiad_coaching import (
    OlympiadCoachingModule,
    aocs_transition,
    build_feedback,
    evaluate_answer,
)
from app.modules.assessment_engine import NINE_DIMS


# ---------------- evaluate_answer 各分支 ----------------
def test_evaluate_correct():
    ref = {"key_steps": ["ε=BLv", "I=ε/R"], "answer_keywords": ["安培力"]}
    ans = "由 ε=BLv 得 I=ε/R，再算安培力"
    assert evaluate_answer(ans, ref, "zh") == "correct"


def test_evaluate_wrong_empty():
    assert evaluate_answer("", {"key_steps": ["x"]}, "zh") == "wrong"


def test_evaluate_wrong_giveup():
    assert evaluate_answer("我错了，不会做", {"key_steps": ["x"]}, "zh") == "wrong"


def test_evaluate_wrong_low_hit():
    ref = {"key_steps": ["ε=BLv", "I=ε/R"], "answer_keywords": ["安培力"]}
    ans = "我用了能量守恒"  # 几乎没命中
    assert evaluate_answer(ans, ref, "zh") == "wrong"


def test_evaluate_partial_mid():
    ref = {"key_steps": ["ε=BLv", "I=ε/R"], "answer_keywords": ["安培力"]}
    ans = "先算 ε=BLv"  # 命中部分
    assert evaluate_answer(ans, ref, "zh") == "partial"


def test_evaluate_none_reference():
    # 无题面元信息 → partial，交由追问澄清
    assert evaluate_answer("我的思路是这样的", None, "zh") == "partial"


# ---------------- aocs_transition 收敛规则 ----------------
def test_transition_correct_streak_converge():
    st = {"turn": 1, "hint_level": 2, "streak_correct": 1, "status": "REINFORCE"}
    out = aocs_transition(st, "correct", "zh")
    assert out["streak_correct"] == 2
    assert out["status"] == "DONE"
    assert out["action"] == "复盘总结"
    assert out["done"] is True
    assert out["turn"] == 2


def test_transition_correct_first():
    st = {"turn": 0, "hint_level": 2, "streak_correct": 0, "status": "DIAGNOSE"}
    out = aocs_transition(st, "correct", "zh")
    assert out["streak_correct"] == 1
    assert out["status"] == "REINFORCE"
    assert out["action"] == "追问"
    assert out["done"] is False


def test_transition_partial_stays():
    st = {"turn": 1, "hint_level": 2, "streak_correct": 0, "status": "GUIDE"}
    out = aocs_transition(st, "partial", "zh")
    assert out["streak_correct"] == 0
    assert out["hint_level"] == 2
    assert out["action"] == "追问"
    assert out["status"] == "FEEDBACK"


def test_transition_wrong_hint_up():
    st = {"turn": 1, "hint_level": 2, "streak_correct": 1, "status": "GUIDE"}
    out = aocs_transition(st, "wrong", "zh")
    assert out["streak_correct"] == 0
    assert out["hint_level"] == 3  # +1
    assert out["action"] == "给提示"
    assert out["status"] == "GUIDE"
    assert out["done"] is False


def test_transition_wrong_at_level5_explain():
    st = {"turn": 4, "hint_level": 5, "streak_correct": 0, "status": "GUIDE"}
    out = aocs_transition(st, "wrong", "zh")
    assert out["hint_level"] == 5  # 封顶
    assert out["action"] == "讲解"
    assert out["status"] == "DONE"
    assert out["done"] is True


def test_transition_turn_increments():
    st = {"turn": 3, "hint_level": 1, "streak_correct": 0, "status": "DIAGNOSE"}
    out = aocs_transition(st, "partial", "zh")
    assert out["turn"] == 4


# ---------------- build_feedback 调用 generate_hint ----------------
def test_build_feedback_give_hint_calls_generator():
    st = {"action": "给提示", "hint_level": 3}
    strat = {"mode": "支架"}
    fb = build_feedback(st, strat, "zh")
    # 应来自 m08.generate_hint（含「关键步骤」相关文案）
    assert "ε=BLv" in fb or "核心物理量" in fb or "控制关系" in fb


def test_build_feedback_inquiry_mode():
    st = {"action": "追问", "hint_level": 1}
    strat = {"mode": "探究"}
    fb = build_feedback(st, strat, "zh")
    assert "物理图像" in fb


def test_build_feedback_explain():
    st = {"action": "讲解", "hint_level": 5}
    strat = {"mode": "支架"}
    fb = build_feedback(st, strat, "zh")
    assert "讲解" in fb


def test_build_feedback_recap():
    st = {"action": "复盘总结", "hint_level": 2}
    strat = {"mode": "对练"}
    fb = build_feedback(st, strat, "zh")
    assert "复盘" in fb


def test_build_feedback_en():
    st = {"action": "追问", "hint_level": 1}
    strat = {"mode": "支架"}
    fb = build_feedback(st, strat, "en")
    assert isinstance(fb, str) and len(fb) > 0


# ---------------- 集成：m10.run(ctx) 多轮模拟 ----------------
def _twin(value: float) -> dict:
    return {d: value for d in NINE_DIMS}


def _ref() -> dict:
    return {"key_steps": ["ε=BLv", "I=ε/R"], "answer_keywords": ["安培力"]}


def test_run_standard_output_and_state_writeback():
    mod = OlympiadCoachingModule()
    twin = _twin(0.2)
    ctx = {
        "student_id": "s1",
        "session_id": "sess1",
        "message": "教练帮我做这道电磁感应题",
        "student_ctx": {"twin": twin},
        "twin": twin,
        "student_answer": "由 ε=BLv 得 I=ε/R，再算安培力",
        "reference": _ref(),
    }
    res = mod.run(ctx)
    assert res["module"] == "m10_olympiad_coaching"
    assert res["action"] == "coach"
    out = res["output"]
    assert set(out.keys()) >= {
        "turn", "feedback", "hint_level", "action",
        "next_step", "aocs_status", "strategy_ref", "aocs_state",
    }
    assert "aocs_state" in out  # 写回支持多轮
    assert out["aocs_status"] in {"DIAGNOSE", "GUIDE", "FEEDBACK", "REINFORCE", "DONE"}
    assert res["next"] == "m11_scientific_inquiry"


def test_run_multiturn_convergence():
    mod = OlympiadCoachingModule()
    twin = _twin(0.2)
    good = "由 ε=BLv 得 I=ε/R，再算安培力"
    ref = _ref()

    # 第一轮：从初始状态起
    ctx1 = {
        "student_ctx": {"twin": twin},
        "twin": twin,
        "student_answer": good,
        "reference": ref,
        "message": "教练帮我做这道电磁感应题",
    }
    r1 = mod.run(ctx1)
    state1 = r1["output"]["aocs_state"]
    assert r1["output"]["turn"] == 1
    assert r1["output"]["aocs_status"] == "REINFORCE"  # streak=1

    # 第二轮：回传 state1，再次答对 → 连对 2 次收敛 DONE
    ctx2 = {
        "student_ctx": {"twin": twin, "aocs_state": state1},
        "twin": twin,
        "student_answer": good,
        "reference": ref,
        "message": "再确认一遍",
    }
    r2 = mod.run(ctx2)
    assert r2["output"]["turn"] == 2  # turn 递增
    assert r2["output"]["aocs_status"] == "DONE"
    assert r2["output"]["action"] == "复盘总结"


def test_run_wrong_escalates_hint():
    mod = OlympiadCoachingModule()
    twin = _twin(0.2)
    ctx = {
        "student_ctx": {"twin": twin, "aocs_state": {
            "turn": 0, "hint_level": 1, "streak_correct": 0, "status": "DIAGNOSE",
        }},
        "twin": twin,
        "student_answer": "我错了不会",
        "reference": _ref(),
        "message": "教练帮我做这道电磁感应题",
    }
    res = mod.run(ctx)
    assert res["output"]["aocs_status"] == "GUIDE"
    assert res["output"]["hint_level"] == 2
    assert res["output"]["action"] == "给提示"


def test_run_defensive_no_ctx():
    mod = OlympiadCoachingModule()
    res = mod.run({})
    assert res["module"] == "m10_olympiad_coaching"
    assert "output" in res
