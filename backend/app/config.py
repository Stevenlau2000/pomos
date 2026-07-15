"""应用配置。

通过 pydantic-settings 读取 .env 与系统环境变量，集中管理所有可调参数。
对应 POMOS 规范中的全局运行配置（非独立模块）。

LLM 多供应商支持：LLM_PROVIDER 可显式指定，留空时按顺序自动探测已配置的 key。
所有 OpenAI 兼容端点（DeepSeek/通义千问/Kimi/智谱GLM/Gemini）共用 openai SDK；
Claude 走原生 anthropic SDK（懒加载）。
"""
from __future__ import annotations

import os

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """全局配置项。"""

    # ---- LLM 多供应商密钥 ----
    # 留空则自动探测；若全部留空则走离线 mock。
    openai_api_key: str = Field(default="", description="OpenAI 密钥")
    deepseek_api_key: str = Field(default="", description="DeepSeek 密钥")
    dashscope_api_key: str = Field(default="", description="阿里通义千问(DashScope)密钥")
    moonshot_api_key: str = Field(default="", description="月之暗面 Kimi 密钥")
    zhipu_api_key: str = Field(default="", description="智谱 GLM 密钥")
    gemini_api_key: str = Field(default="", description="Google Gemini 密钥")
    anthropic_api_key: str = Field(default="", description="Anthropic Claude 密钥")

    # 显式指定供应商（openai/deepseek/qwen/moonshot/zhipu/gemini/anthropic/custom），
    # 留空则自动探测；设为 custom 时需配合 LLM_BASE_URL + LLM_API_KEY。
    llm_provider: str = Field(default="", description="强制指定 LLM 供应商，留空自动探测")

    # 自定义 OpenAI 兼容端点（LLM_PROVIDER=custom 时使用）
    llm_base_url: str = Field(default="", description="自定义 OpenAI 兼容 base_url")
    llm_api_key: str = Field(default="", description="自定义端点密钥(custom 模式)")

    # 模型名：指定 LLM_PROVIDER 时建议填对应模型；留空用各供应商默认模型。
    llm_model: str = Field(default="", description="模型名，留空用供应商默认模型")

    # 生成参数
    llm_temperature: float = Field(default=0.7, description="采样温度")
    llm_max_tokens: int = Field(default=1200, description="最大生成 token 数")

    # 教练回复语言（zh/en），影响 system prompt 与生成指令
    coach_language: str = Field(default="zh", description="教练回复语言 zh/en")

    # 数据库（开发期默认 SQLite，可切 PostgreSQL）
    database_url: str = Field(default="sqlite:///./pomos.db", description="SQLAlchemy 连接串")

    # Redis（仅预留，不强制连接）
    redis_url: str = Field(default="redis://localhost:6379/0", description="Redis 连接串")

    # 跨域
    # 注意：CORS 白名单仅在进程启动时由 main.py 构建一次 CORSMiddleware 时读取。
    # 经 PUT /api/settings 修改 cors_origins 仅更新本单例与 runtime_settings.json，
    # 不会热改已固化的中间件——实际生效需重启后端进程（见 settings 路由的 cors_origins_note）。
    cors_origins: str = Field(
        default="http://localhost:3000",
        description="允许的前端来源，逗号分隔（修改后需重启后端进程生效）",
    )

    # 应用元信息
    app_version: str = Field(default="0.1.0", description="后端版本号")

    @property
    def cors_origin_list(self) -> list[str]:
        """将逗号分隔的 CORS_ORIGINS 解析为列表。

        该列表在 main.py 启动期被 CORSMiddleware 固化；运行时修改 settings.cors_origins
        不会自动传播到中间件，需重启进程后方可生效。
        """
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


# 全局单例配置
settings = Settings()


# ----------------------------------------------------------------- 运行时可写配置层
# 前端「设置面板」可在运行时修改的部分字段，落盘到 runtime_settings.json，
# 进程重启后自动加载，实现对 .env 的覆盖（不污染 .env，便于回滚）。
import json
from pathlib import Path

RUNTIME_CONFIG_PATH = Path(__file__).resolve().parent.parent / "runtime_settings.json"

# 允许前端在运行时修改的字段白名单（含所有密钥与生成参数）
_RUNTIME_WRITABLE: list[str] = [
    "openai_api_key", "deepseek_api_key", "dashscope_api_key", "moonshot_api_key",
    "zhipu_api_key", "gemini_api_key", "anthropic_api_key",
    "llm_provider", "llm_base_url", "llm_api_key", "llm_model",
    "llm_temperature", "llm_max_tokens", "coach_language", "cors_origins",
]


def load_runtime_overrides() -> None:
    """启动时若存在 runtime_settings.json，将其中字段覆盖到 settings 单例。"""
    if not RUNTIME_CONFIG_PATH.exists():
        return
    try:
        with open(RUNTIME_CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for k, v in data.items():
            if k in _RUNTIME_WRITABLE and hasattr(settings, k):
                setattr(settings, k, v)
    except Exception:
        return


def _persist_runtime_settings() -> None:
    """将当前可写字段快照写入 runtime_settings.json。"""
    snap = {k: getattr(settings, k) for k in _RUNTIME_WRITABLE if hasattr(settings, k)}
    try:
        with open(RUNTIME_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(snap, f, ensure_ascii=False, indent=2)
        # 含明文密钥的配置文件限制为仅属主可读写，降低泄露面（配合 .gitignore 忽略）
        try:
            os.chmod(RUNTIME_CONFIG_PATH, 0o600)
        except OSError:
            pass
    except Exception:
        return


def apply_runtime_settings(data: dict) -> dict:
    """热更新内存单例并落盘，返回脱敏后的当前配置快照。"""
    for k, v in data.items():
        if k in _RUNTIME_WRITABLE and hasattr(settings, k):
            setattr(settings, k, v)
    _persist_runtime_settings()
    return serialize_settings(mask_keys=True)


def serialize_settings(mask_keys: bool = True) -> dict:
    """导出当前配置；mask_keys=True 时密钥仅保留前 4 位 + 掩码。"""
    out: dict = {}
    for k in _RUNTIME_WRITABLE:
        if not hasattr(settings, k):
            continue
        v = getattr(settings, k)
        if mask_keys and k.endswith("_api_key") and v:
            s = str(v)
            v = f"{s[:4]}{'*' * max(0, len(s) - 4)}"
        out[k] = v
    return out


# ----------------------------------------------------------------- 配置校验
# 前端「设置面板」保存前 / 后端 PUT /api/settings 落库前，对传入字段做合法性校验，
# 非法配置直接拒绝（422），避免脏配置写入 runtime_settings.json 导致后端不可用。
_ALLOWED_LANGUAGES = {"zh", "en"}
_ALLOWED_PROVIDERS = {
    "", "auto", "openai", "deepseek", "qwen", "moonshot",
    "zhipu", "gemini", "anthropic", "custom",
}


def validate_settings(data: dict) -> list[str]:
    """校验运行时配置字段，返回错误文案列表（空列表表示通过）。

    仅校验 data 中实际传入的字段；不传入的字段不参与校验。
    """
    errors: list[str] = []

    if "coach_language" in data and data["coach_language"] not in _ALLOWED_LANGUAGES:
        errors.append("coach_language 仅支持 zh 或 en")

    if "llm_provider" in data and data["llm_provider"] not in _ALLOWED_PROVIDERS:
        errors.append(
            "llm_provider 非法，可选：auto/openai/deepseek/qwen/moonshot/zhipu/gemini/anthropic/custom"
        )

    if "llm_base_url" in data and data["llm_base_url"]:
        url = str(data["llm_base_url"]).strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            errors.append("llm_base_url 必须为合法的 http(s) URL")
        elif ".." in url.split("://", 1)[-1]:
            errors.append("llm_base_url 含有非法路径片段")

    if "llm_temperature" in data:
        try:
            t = float(data["llm_temperature"])
            if not (0.0 <= t <= 2.0):
                errors.append("llm_temperature 须在 0 ~ 2 之间")
        except (TypeError, ValueError):
            errors.append("llm_temperature 必须为数字")

    if "llm_max_tokens" in data:
        try:
            n = int(data["llm_max_tokens"])
            if not (100 <= n <= 32000):
                errors.append("llm_max_tokens 须在 100 ~ 32000 之间")
        except (TypeError, ValueError):
            errors.append("llm_max_tokens 必须为整数")

    # custom 模式必须给出 base_url 与 api_key
    provider = data.get("llm_provider")
    if provider == "custom":
        if not data.get("llm_base_url"):
            errors.append("custom 供应商必须填写 base_url")
        if not data.get("llm_api_key"):
            errors.append("custom 供应商必须填写 api_key")

    return errors


# 启动时应用已有的运行时覆盖（若存在）
load_runtime_overrides()
