"""m09 竞赛题智能单测：推荐非空含 solution + 改编题考点不变（纯函数 + 集成）。"""
from app.modules.m09_olympiad_problem import (
    OlympiadProblemModule,
    adapt_problem,
    localize_problem,
    match_difficulty,
    recommend_problem,
)
from app.data.problem_bank import PROBLEM_BANK


def test_recommend_nonempty_with_solution():
    probs = recommend_problem("力学", 4, "zh")
    assert len(probs) > 0
    assert "solution" in probs[0]
    assert isinstance(probs[0]["solution"], str) and len(probs[0]["solution"]) > 0


def test_match_difficulty_from_message_and_ctx():
    # 消息命中板块关键词 → 电磁学；难度消息未命中 → 回退 student_ctx 的 2
    board, diff = match_difficulty("来一道电磁感应题", {"board": "光学", "difficulty": 2})
    assert board == "电磁学"          # 消息优先于 ctx
    assert diff == 2                  # 难度回退 ctx

    # 消息同时命中难度关键词（压轴→5）覆盖 ctx
    board2, diff2 = match_difficulty("来道电磁学压轴题", {"board": "力学", "difficulty": 2})
    assert board2 == "电磁学"
    assert diff2 == 5                  # 消息优先级最高


def test_adapt_keeps_kpoint():
    p = localize_problem(PROBLEM_BANK[0], "zh")
    original_kpoint = p["考点"]
    a = adapt_problem(p, "zh", target_difficulty=5)
    assert a["考点"] == original_kpoint  # 考点不变
    assert a["difficulty"] == 5
    assert a["adapted"] is True


def test_run_normal():
    mod = OlympiadProblemModule()
    ctx = {
        "student_id": "s1",
        "message": "来道力学题",
        "student_ctx": {"board": "力学", "difficulty": 4},
    }
    res = mod.run(ctx)
    assert res["module"] == "m09_olympiad_problem"
    out = res["output"]
    assert len(out["problems"]) > 0
    assert "solution" in out["problems"][0]
    assert isinstance(out["match_note"], str) and len(out["match_note"]) > 0
    assert res["next"] == "m10_olympiad_coaching"


def test_run_adapts_when_mismatch():
    mod = OlympiadProblemModule()
    # 力学难度 5（题库力学最高 4）→ 应触发参数改编匹配档位
    ctx = {
        "student_id": "s1",
        "message": "力学压轴题",
        "student_ctx": {"board": "力学", "difficulty": 5},
    }
    res = mod.run(ctx)
    out = res["output"]
    assert out["adapted"] is True
    for p in out["problems"]:
        assert p["difficulty"] == 5  # 难度档位已匹配
        # 考点保持不变（取原题库该题的考点）
