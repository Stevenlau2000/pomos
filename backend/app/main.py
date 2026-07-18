"""POMOS 后端入口（FastAPI 应用）。

挂载路由、CORS 中间件，并在启动时建表。可用 ``uvicorn app.main:app`` 启动。

安全加固（架构评审 T1 / P0-1）：注册全局异常处理，对外只返回通用错误 JSON
（含 request_id 用于日志关联），绝不把内部异常原文（路径/SQL/模型配置）回传前端。
"""
import logging
import os
import uuid

from fastapi import FastAPI, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.security import verify_token
from app.database import Base, engine
from app.api.routes import health, chat, students, settings as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("pomos")

app = FastAPI(title="POMOS", version=settings.app_version)


def _request_id(request: Request) -> str:
    """返回请求级 request_id（中间件已写入 request.state，缺失时兜底生成）。"""
    rid = getattr(request.state, "request_id", None)
    if not rid:
        rid = str(uuid.uuid4())
        request.state.request_id = rid
    return rid


def _generic_error(status_code: int, request_id: str) -> JSONResponse:
    """构造对外只暴露通用错误信息的响应，避免泄露内部细节。"""
    return JSONResponse(
        status_code=status_code,
        content={"error": "INTERNAL_ERROR", "request_id": request_id},
    )


@app.middleware("http")
async def _request_id_middleware(request: Request, call_next):
    """为每个请求分配 request_id，便于跨日志与响应关联排查。"""
    request.state.request_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """兜底：任何未捕获的原始异常都只返回通用 500，完整堆栈仅入日志。"""
    request_id = _request_id(request)
    logger.exception(
        "未捕获异常 request_id=%s method=%s path=%s",
        request_id, request.method, request.url.path,
    )
    return _generic_error(500, request_id)


@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """HTTP 异常：保留原始状态码（4xx/5xx），但不把内部 detail 透传给客户端。

    说明：为保持现有对外行为（如 404/422 状态码契约）与既有测试，
    这里沿用异常原有的状态码，仅将响应体替换为通用错误 JSON。
    若需要把所有响应强制为 500，可在此统一改写为 500。
    """
    status_code = exc.status_code
    request_id = _request_id(request)
    if status_code >= 500:
        logger.error(
            "HTTP 服务端异常 request_id=%s status=%s path=%s",
            request_id, status_code, request.url.path,
        )
    return _generic_error(status_code, request_id)


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """请求参数校验失败：保留 422，但响应体替换为通用错误 JSON（不回显校验细节）。"""
    request_id = _request_id(request)
    logger.warning(
        "请求参数校验失败 request_id=%s path=%s", request_id, request.url.path
    )
    return _generic_error(422, request_id)


# 错题图片静态目录（backend/uploads），通过 /uploads/<file> 访问
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 跨域：允许 CORS_ORIGINS 指定的前端来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    """启动时根据模型元数据创建数据表（SQLite 首次运行建表）。"""
    Base.metadata.create_all(bind=engine)


# 挂载路由（统一前缀 /api）
app.include_router(health.router, prefix="/api", dependencies=[Depends(verify_token)])
app.include_router(chat.router, prefix="/api", dependencies=[Depends(verify_token)])
app.include_router(students.router, prefix="/api", dependencies=[Depends(verify_token)])
app.include_router(settings_router.router, prefix="/api", dependencies=[Depends(verify_token)])
