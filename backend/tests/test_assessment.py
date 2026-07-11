"""评估引擎（离线启发式路径）单测：错误概念检测 + 能力评估。"""
import asyncio

from app.modules.assessment_engine import (
    compute_assessment,
    detect_misconceptions,
    heuristic_assess,
)
from app.llm import offline_tutor


def test_offline_tutor_nonempty():
    out = offline_tutor("讲讲动量守恒", "zh")
    assert isinstance(out, str) and len(out) > 0


def test_detect_misconceptions():
    hits = detect_misconceptions("力是维持物体运动的原因，所以撤去力就停", "zh")
    assert len(hits) >= 1
    dims = [d for h in hits for d in h["dims"]]
    assert "reasoning" in dims or "concept" in dims


def test_heuristic_assess_output_shape():
    twin = {d: 0.0 for d in [
        "concept", "modeling", "reasoning", "calculation",
        "experiment", "transfer", "meta", "competition", "growth",
    ]}
    res = heuristic_assess("为什么？请推导方程并建模", twin, "好的", "zh")
    assert 0.0 <= res["pq"] <= 1.0
    assert isinstance(res["mastery_delta"], dict)
    assert len(res["mastery_delta"]) > 0  # 命中了 reasoning/modeling 关键词


def test_heuristic_assess_misconception_penalty():
    twin = {d: 0.5 for d in [
        "concept", "modeling", "reasoning", "calculation",
        "experiment", "transfer", "meta", "competition", "growth",
    ]}
    res = heuristic_assess("力是维持物体运动的原因", twin, "x", "zh")
    # 错误概念应为 reasoning/concept 带来负向 delta
    neg = [v for k, v in res["mastery_delta"].items() if v < 0]
    assert len(neg) >= 1
    assert len(res["weak_concepts"]) >= 1


def test_compute_assessment_mock():
    twin = {d: 0.2 for d in [
        "concept", "modeling", "reasoning", "calculation",
        "experiment", "transfer", "meta", "competition", "growth",
    ]}
    res = asyncio.run(compute_assessment("请帮我推导单摆周期", twin, "ok", "zh"))
    assert set(res.keys()) >= {"pq", "mastery_delta", "weak_concepts", "recommendations"}
    assert 0.0 <= res["pq"] <= 1.0
