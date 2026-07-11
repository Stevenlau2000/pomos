# POMOS Backend（最小可运行骨架）

> POMOS = Physics Olympiad Mentor OS，一套面向中国高中物理竞赛（CPhO / IPhO）的 AI-Native Agent 操作系统。
> 本目录是 **v6.0 落地工程的最小可运行骨架**：结构/命名映射回 `POMOS-v6` 规范（16 个核心模块 01–16），但每个模块仅提供结构化 stub，并非完整实现。

## 技术栈

- **后端**：FastAPI（Python 3.11+）
- **AI 编排**：LangGraph（实现 Runtime Orchestrator，含无 LangGraph 时的退化链）
- **LLM**：OpenAI（`LLM_MODEL` 默认 `gpt-5.5`，可用环境变量切换；未配置 key 时返回结构化 mock）
- **数据库**：SQLAlchemy，开发期默认 SQLite（`DATABASE_URL` 可切 PostgreSQL）
- **Redis**：仅预留客户端（`REDIS_URL`），不强制连接

## 目录结构

```
backend/
├── requirements.txt
├── README.md
├── .env.example
└── app/
    ├── main.py          # FastAPI 入口
    ├── config.py        # pydantic-settings 配置
    ├── database.py      # SQLAlchemy engine / SessionLocal / Base / get_db
    ├── models.py        # Student / Message / Assessment ORM
    ├── schemas.py       # Pydantic 请求/响应模型
    ├── llm.py           # OpenAI 异步客户端封装（无 key 返回 mock）
    ├── memory.py        # CMOS 六层记忆存储 stub
    ├── orchestrator.py  # LangGraph 意图分类→模块分发→响应装配
    ├── api/routes/      # health / chat / students 路由
    └── modules/         # 模块基类 + 16 个模块 stub
```

## 快速开始

```bash
cd pomos-app/backend
python -m venv .venv && source .venv/bin/activate   # 可选
pip install -r requirements.txt
cp .env.example .env                                # 按需填写 OPENAI_API_KEY
python -c "from app.main import app"                # import 自检
uvicorn app.main:app --reload --port 8000           # 启动
```

## API 契约（前端按此对接）

- `GET  /api/health` → `{status, version, runtime, modules_loaded, llm_model}`
- `POST /api/chat`  → `{student_id, message, session_id?}` → `{session_id, reply, module_trace[], student_update}`
- `POST /api/students` → `{name, grade?}` → `{student_id, name, created_at}`
- `GET  /api/students/{student_id}` → Student Twin（九维 mastery）
- `GET  /api/students/{student_id}/assessment` → `{pq, radar, growth_curve, readiness}`

## 说明

- 所有模块 stub 的 `run(ctx)` 返回结构化 dict：`{module, action, output, next}`。
- 未配置 `OPENAI_API_KEY` 时，LLM 调用返回中文 mock 文本，整条 orchestrator 链路不会报错。
- `orchestrator.py` 在导入 `langgraph` 失败时自动退化为顺序链（classify→dispatch→assemble），保证 `app.main:app` 始终可导入、可启动。
