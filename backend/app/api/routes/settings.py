"""运行时设置路由：GET /api/settings, PUT /api/settings。

前端「设置面板」通过此接口读取与保存配置（语言、API Key、模型、温度等）。
密钥写入后端 runtime_settings.json，进程重启后仍生效，且不会污染 .env。
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import apply_runtime_settings, serialize_settings, validate_settings
from app.llm import probe_connection

router = APIRouter(tags=["settings"])
logger = logging.getLogger(__name__)


class SettingsUpdate(BaseModel):
    """可修改的配置项（均为可选，仅更新传入字段）。"""

    openai_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    dashscope_api_key: Optional[str] = None
    moonshot_api_key: Optional[str] = None
    zhipu_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_max_tokens: Optional[int] = None
    coach_language: Optional[str] = None
    cors_origins: Optional[str] = None


@router.get("/settings")
async def get_settings() -> dict:
    """返回当前配置（密钥已脱敏）。"""
    return serialize_settings(mask_keys=True)


@router.put("/settings")
async def put_settings(body: SettingsUpdate, request: Request) -> dict:
    """热更新配置并持久化，返回脱敏后的当前配置快照。

    落库前先做合法性校验，非法配置直接返回 422，避免脏配置写入 runtime_settings.json。
    """
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    errors = validate_settings(data)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})
    try:
        return apply_runtime_settings(data)
    except Exception as exc:  # noqa: BLE001
        request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
        logger.exception("保存设置失败 request_id=%s", request_id)
        # 安全加固（P0-1）：对外只返回通用 500，不泄露内部异常原文
        raise HTTPException(status_code=500)


@router.post("/settings/test")
async def test_connection() -> dict:
    """探测当前 LLM 供应商连接是否真实可用（前端「测试连接」按钮）。

    未配置密钥时返回 ok=false 但给出离线模式提示；已配置但调用失败时返回错误详情。
    """
    ok, detail = await probe_connection()
    return {"ok": ok, "detail": detail, "mock_mode": not ok}
