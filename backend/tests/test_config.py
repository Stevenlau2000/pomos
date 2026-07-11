"""配置校验单测：validate_settings 拒绝非法输入、放行合法输入。"""
from app.config import validate_settings


def test_valid_settings_pass():
    errs = validate_settings({
        "coach_language": "zh",
        "llm_provider": "openai",
        "llm_temperature": 0.7,
        "llm_max_tokens": 1200,
        "cors_origins": "http://localhost:3000",
    })
    assert errs == []


def test_invalid_language():
    errs = validate_settings({"coach_language": "fr"})
    assert any("coach_language" in e for e in errs)


def test_invalid_provider():
    errs = validate_settings({"llm_provider": "baidu"})
    assert any("llm_provider" in e for e in errs)


def test_invalid_base_url():
    errs = validate_settings({"llm_base_url": "ftp://example.com"})
    assert any("URL" in e for e in errs)


def test_base_url_ok_with_scheme():
    errs = validate_settings({"llm_base_url": "https://api.example.com/v1"})
    assert not any("URL" in e for e in errs)


def test_temperature_out_of_range():
    errs = validate_settings({"llm_temperature": 3.0})
    assert any("temperature" in e for e in errs)


def test_max_tokens_out_of_range():
    errs = validate_settings({"llm_max_tokens": 10})
    assert any("max_tokens" in e for e in errs)


def test_custom_requires_base_url_and_key():
    errs = validate_settings({"llm_provider": "custom"})
    assert any("base_url" in e for e in errs)
    assert any("api_key" in e for e in errs)


def test_partial_valid_field_only():
    # 只传合法字段时不应误报
    errs = validate_settings({"coach_language": "en"})
    assert errs == []
