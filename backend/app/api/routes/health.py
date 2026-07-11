"""健康检查路由：GET /api/health。"""
from fastapi import APIRouter

from app.config import settings
from app.modules import MODULES_LOADED
from app.llm import is_mock, active_provider, active_model

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """返回服务运行状态、版本、运行时与已加载模块数。"""
    return {
        "status": "ok",
        "version": settings.app_version,
        "runtime": "langgraph",
        "modules_loaded": MODULES_LOADED,
        "llm_provider": active_provider() or "mock",
        "llm_model": active_model(),
        "mock_mode": is_mock(),
    }
