"""m03 教学哲学单测：philosophy_templates 长度 ≥3（纯函数 + 集成）。"""
from app.modules.m03_philosophy import PhilosophyModule, build_philosophy


def test_philosophy_templates_length_ge3():
    mod = PhilosophyModule()
    res = mod.run({"message": "你的教学理念是什么"})
    templates = res["output"]["philosophy_templates"]
    assert isinstance(templates, list)
    assert len(templates) >= 3


def test_build_philosophy_keys_and_zh():
    phil = build_philosophy("zh")
    assert set(phil.keys()) >= {"style", "scaffolding", "philosophy_templates"}
    assert phil["scaffolding"] is True
    assert len(phil["philosophy_templates"]) >= 3
    # 三类信条类型齐全
    types = {t["type"] for t in phil["philosophy_templates"]}
    assert "苏格拉底式提问" in types
    assert "脚手架递进" in types
    assert "元认知反思" in types


def test_build_philosophy_en():
    phil = build_philosophy("en")
    types = {t["type"] for t in phil["philosophy_templates"]}
    assert "Socratic Questioning" in types
    assert phil["scaffolding"] is True


def test_run_defensive_no_ctx():
    mod = PhilosophyModule()
    res = mod.run({})
    assert res["module"] == "m03_philosophy"
    assert len(res["output"]["philosophy_templates"]) >= 3
