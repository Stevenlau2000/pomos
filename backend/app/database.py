"""SQLAlchemy 数据库连接层。

提供 engine / SessionLocal / Base 以及 FastAPI 依赖 `get_db`。
开发期默认 SQLite；通过 `DATABASE_URL` 可无缝切换到 PostgreSQL。
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# SQLite 需要关闭单连接检查以适配多线程
_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=_connect_args, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


def get_db():
    """FastAPI 依赖：每次请求提供一个数据库会话并在结束后关闭。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
