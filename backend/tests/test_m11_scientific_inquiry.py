"""m11 科学探究单测：实验设计 + 误差分析(uncertainty) + 数据拟合 + 防御式。"""
from app.modules.m11_scientific_inquiry import (
    ScientificInquiryModule,
    data_fitting,
    design_experiment,
    error_analysis,
)


def test_design_experiment_matches_template():
    text = design_experiment("测量重力加速度 g 的实验", "zh")
    assert "实验目标" in text
    assert "设计步骤" in text


def test_error_analysis_has_uncertainty():
    ea = error_analysis("zh")
    assert "uncertainty" in ea
    u = ea["uncertainty"]
    # A类 / B类 结构化字段
    assert "A类" in u and "B类" in u


def test_data_fitting_nonempty():
    fit = data_fitting("zh")
    assert "逐差法" in fit


def test_run_normal():
    mod = ScientificInquiryModule()
    ctx = {
        "student_id": "s1",
        "message": "请设计一个测量电阻的实验",
        "twin": {},
        "student_ctx": {"twin": {}},
    }
    res = mod.run(ctx)
    assert res["module"] == "m11_scientific_inquiry"
    out = res["output"]
    assert "experiment_design" in out
    assert "error_analysis" in out
    assert "uncertainty" in out["error_analysis"]
    assert "data_fitting" in out
    assert res["next"] == "m12_learning_orchestration"


def test_run_defensive_no_ctx():
    mod = ScientificInquiryModule()
    res = mod.run({})
    assert isinstance(res["output"], dict)
    assert "experiment_design" in res["output"]
    assert "uncertainty" in res["output"]["error_analysis"]
