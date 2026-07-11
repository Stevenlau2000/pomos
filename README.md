# POMOS v6.0 · Application Scaffold

> Physics Olympiad Mentor OS —— 面向中国高中物理竞赛（CPhO / IPhO）的 AI-Native 导师系统。
> 本目录是 **v6.0 规范的落地脚手架**（最小可运行骨架），规范本体在 `../"Obsidian Vault"/POMOS/POMOS-v6/`（此处仅作引用，并非本仓库一部分）。

## 仓库与规范的关系

| POMOS-v6 规范层 | 规范模块 | 本脚手架落点 |
| --------------- | -------- | ------------ |
| Persona (01–03) | 身份 / 使命 / 教学哲学 | `backend/app/modules/m01~m03_*.py` |
| Cognitive (04–05) | 学生建模 / 认知诊断 | `backend/app/modules/m04_*.py`, `m05_*.py` |
| Knowledge (06–07) | 知识图谱 / 物理思维 | `backend/app/modules/m06_*.py`, `m07_*.py` |
| Teaching (08–12) | 教学策略 / 竞赛题 / 训练 / 探究 / 编排 | `backend/app/modules/m08~m12_*.py` |
| Runtime (13–16) | 记忆 OS / 能力评估 / 多模态 / 编排大脑 | `backend/app/modules/m13~m16_*.py` + `orchestrator.py` |

**Runtime Orchestrator**（`16_Runtime_Orchestrator`）= LangGraph 状态图，统一编排上述 16 个模块。

## 技术栈

| 层 | 技术 |
| -- | ---- |
| 前端 | Next.js 14 (App Router) + React + TypeScript + Tailwind CSS |
| UI | shadcn/ui 风格（Radix + CVA + Lucide） |
| 图表 | ECharts（学习曲线 / PQ 雷达 / 知识图谱） |
| 数学 | KaTeX |
| Markdown | react-markdown + Mermaid |
| 后端 | FastAPI (Python) |
| AI 编排 | LangGraph（Runtime Orchestrator） |
| LLM | OpenAI（默认 `gpt-5.5`，可扩展 Claude / Gemini） |
| 数据库 | PostgreSQL + Redis（开发期 SQLite） |
| 向量检索 | pgvector / Milvus（后续引入） |
| 部署 | Vercel（前端）+ Railway / Render / Fly.io（后端） |
| 认证 | Clerk / Auth.js（后续多用户） |

## 目录结构

```
pomos-app/
├── docker-compose.yml      # 本地 postgres + redis
├── .env.example            # 环境变量模板
├── .gitignore
├── backend/                # FastAPI + LangGraph
└── frontend/               # Next.js + Tailwind
```

## 快速启动

### 1. 基础设施（可选，开发期可只用 SQLite）
```bash
docker compose up -d        # 启动 postgres + redis
```

### 2. 后端
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env     # 按需填 OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
# 健康检查： curl http://localhost:8000/api/health
```
> 未配置 `OPENAI_API_KEY` 时，Orchestrator 走 **mock 链路**，应用仍可完整启动并跑通对话接口。

### 3. 前端
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                 # http://localhost:3000
```

### 4. 联调
前端通过 `next.config.mjs` 的 rewrites 将 `/api/*` 代理到 `http://localhost:8000/api/*`；
也可直接设置 `NEXT_PUBLIC_API_BASE`。

## API 契约（前后端对齐）

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET | `/api/health` | 健康 + 模块加载数 + LLM 模型 |
| POST | `/api/chat` | 导师对话（student_id, message）→ reply + module_trace |
| POST | `/api/students` | 创建学生 |
| GET | `/api/students/{id}` | 学生数字孪生（九维） |
| GET | `/api/students/{id}/assessment` | PQ 雷达 + 成长曲线 + 就绪度 |

详见 `backend/app/schemas.py` 与 `frontend/lib/api.ts`。

## 部署（GitHub Pages / 静态托管）

> 关键约束：GitHub Pages 只能托管**静态前端**，FastAPI 后端无法部署上去。
> 因此前端内置「离线演示模式」——后端不可达时自动切换为浏览器内物理教练 + localStorage 持久化，测试人员打开即用。

### 一键部署到 GitHub Pages

1. 将本仓库推送到 GitHub（`pomos-app` 作为仓库根，含 `frontend/` 与 `.github/workflows/deploy.yml`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送到 `main` 分支即自动构建并发布；地址为 `https://<用户>.github.io/<仓库名>/`。

### 本地静态构建验证

```bash
cd frontend
npm install
npm run build          # 生成 out/（静态导出）
npx serve out          # 或 python -m http.server 预览
```

### 离线模式说明

- 前端启动时探测 `/api/health`，失败即进入离线模式（浏览器内 `lib/offlineApi.ts`）。
- 学生、错题、对话历史、设置均保存在**访问者本地浏览器**（localStorage），互不共享。
- 对话由内置物理教练启发式驱动（覆盖力学/电磁/热学/光学/近代物理/量子/流体等专题），支持打字机式流式输出。
- 仪表盘 / 评估 / 训练计划由确定性生成器基于学生标识产生稳定 mock 数据。

### 连接真实后端（可选）

若希望测试人员用真实 AI 辅导，需将后端（FastAPI）部署到可访问地址（如 Render / Railway / Fly.io），
然后在部署前端时设置环境变量 `NEXT_PUBLIC_API_BASE=https://你的后端地址`，前端会自动切回在线模式。

## 状态

- ✅ 脚手架骨架（模块 stub / 对话链路 / 仪表盘图表）
- ⏳ 完整模块逻辑、真实 LLM 调优、PostgreSQL 迁移、向量检索、认证

> Status: v0.1.0 · Scaffold
