# POMOS · 物理竞赛导师系统（前端 · 导师工作台）

POMOS = Physics Olympiad Mentor OS，面向中国高中物理竞赛（CPhO / IPhO）的 AI-Native 导师系统。

本目录是 **最小可运行骨架**，采用「导师工作台」布局，将 POMOS 的核心能力以多视图方式完整呈现，而非单一对话框。

## 工作台导航（功能映射）

左侧导航每一项是 POMOS 的一个能力模块：

| 视图 | 对应 POMOS 能力 |
|------|----------------|
| 对话辅导 | m07/m08/m09 Socratic 导师对话（Markdown + KaTeX + Mermaid） |
| 能力总览 | m14 HPCAS：PQ 雷达 / 学习曲线 / 备赛就绪度 |
| 数字孪生 | m04 Student Digital Twin 九维画像 |
| 知识图谱 | m06 六层物理知识图谱（点击节点看详情） |
| 认知诊断 | m05 PCDF 八层 + 认知 Bug 清单 |
| 竞赛训练 | m10 AOCS 周期 + m12 ALOE 今日规划 |
| 错题本 | 错题归因与复盘（m05 诊断 + m13 记忆） |
| 模块地图 | 16 模块 / 五层架构总览 |

> 对话视图接入真实后端（`/api/chat`）；其余视图在后端未接入（Mock 模式）时由 `lib/pomosData.ts` 的结构化示例数据驱动，便于演示与前端联调。

## 技术栈

- 框架：Next.js 14（App Router）+ React 18 + TypeScript（strict）
- 样式：Tailwind CSS（shadcn 浅色主题 + brand 强调色）
- UI 组件：shadcn/ui 风格（Radix UI + cva + tailwind-merge + clsx）+ Lucide Icons
- 图表：ECharts（`echarts-for-react`）：雷达 / 折线 / 仪表 / 力导向图
- 数学公式：KaTeX（`react-katex` + `katex`）
- Markdown：`react-markdown` + `remark-gfm` + Mermaid
- 后端地址：`http://localhost:8000`（开发代理到 `/api`）

## 目录结构

```
frontend/
├── app/
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 导师工作台（Sidebar + Topbar + 多视图）
├── components/
│   ├── ui/               # button / card / input / badge / progress
│   ├── layout/           # Sidebar / Topbar
│   ├── chat/             # ChatWindow / ChatInput / MessageBubble
│   ├── dashboard/        # PqRadar / LearningCurve / ReadinessGauge / KnowledgeGraph
│   └── views/            # 8 个功能视图
└── lib/                  # utils(cn) + api(类型化客户端) + pomosData(示例数据)
```

## 快速开始

```bash
cp .env.local.example .env.local   # 配置后端地址
npm install
npm run dev                        # http://localhost:3000
```

后端需实现契约（见 `lib/api.ts` 类型）：
- `GET  /api/health`
- `POST /api/chat`
- `POST /api/students`
- `GET  /api/students/{student_id}`
- `GET  /api/students/{student_id}/assessment`

## 类型检查 / 构建

```bash
npm run typecheck   # npx tsc --noEmit
npm run build       # 生产构建
```
