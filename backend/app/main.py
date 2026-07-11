"""POMOS 后端入口（FastAPI 应用）。

挂载路由、CORS 中间件，并在启动时建表。可用 ``uvicorn app.main:app`` 启动。
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.api.routes import health, chat, students, settings as settings_router

app = FastAPI(title="POMOS", version=settings.app_version)

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
app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
