# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260711-001] best_practice

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
滚动视图根容器必须带高度约束（h-full / min-h-0），否则被外层 overflow-hidden 裁掉。

### Details
POMOS 主区为 `<main className="flex-1 overflow-hidden">`。内部视图若根节点用
`space-y-4 overflow-y-auto p-6` 且**未加 h-full**，其高度会随内容撑高，overflow 永不触发，
导致内容超出部分被 main 裁掉（历史 bug：模块地图认知层以下不显示）。ChatView/GraphView
用了 h-full 故正常。所有同级视图（Overview/Twin/Training/Mistakes/Diagnosis）写法一致，均有同类隐患。

### Suggested Action
视图根容器统一写成 `h-full space-y-4 overflow-y-auto p-6`（或包一层 `min-h-0`）。
可借机封装一个 `<ViewScroll>` 包装组件消除重复。

### Metadata
- Source: conversation (audit 2026-07-11)
- Related Files: frontend/components/views/*.tsx, frontend/app/page.tsx
- Tags: layout,flexbox,overflow
- Pattern-Key: frontend.scroll_container_height
- Recurrence-Count: 1

---

## [LRN-20260711-002] best_practice

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
运行时配置密钥禁止明文落盘；敏感 json 必须 gitignore + 0600。

### Details
`config.py:_persist_runtime_settings` 将 7 个供应商 api_key 明文写入
`backend/runtime_settings.json`，且该文件**未被 .gitignore 覆盖**（实测 .gitignore 缺这一条）。
一旦仓库提交即泄露密钥。同理 `backend/uploads/` 也未被忽略。

### Suggested Action
- 把 `runtime_settings.json`、`backend/uploads/`、`*.db`（已有）加入 .gitignore。
- 落盘时 `os.open(..., 0o600)` 限制权限；密钥考虑走环境变量/密钥库，json 仅存非敏感项。

### Metadata
- Source: conversation (audit 2026-07-11)
- Related Files: backend/app/config.py, .gitignore
- Tags: security,secrets,gitignore
- Pattern-Key: config.secrets_not_plaintext
- Recurrence-Count: 1

---

## [LRN-20260711-003] knowledge_gap

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
CMOS 记忆是进程级全局单例，不按 student_id 隔离，与「系统大脑读该生记忆」语义不符。

### Details
`backend/app/memory.py` 的 `_memory = CMOSMemory()` 是全局单例；`orchestrator._dispatch`
调用 `get_memory().snapshot()` 返回的是**全局**记忆，m13_memory_os 每次 dispatch 都
`mem.write("episodic", ...)` 到同一进程池，长生命周期只增不减、且所有学生共享同一记忆。
「CMOS 六层记忆」名不副实，距离真实个性化记忆还差多租户分片。

### Suggested Action
把内存存储按 `student_id` 分桶（dict[str, CMOSMemory]），并在写入接口加容量上限/LRU；
snapshot 只返回当前学生桶。生产可换 Redis。

### Metadata
- Source: conversation (audit 2026-07-11)
- Related Files: backend/app/memory.py, backend/app/modules/m13_memory_os.py, backend/app/orchestrator.py
- Tags: memory,multi-tenant,architecture
- See Also: FEAT-20260711-001
- Recurrence-Count: 1

---

## [LRN-20260714-001] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: critical
**Status**: pending
**Area**: backend

### Summary
后端把原始异常 `str(exc)` 直接回传客户端（3 处），泄露内部路径/SQL/模型配置。

### Details
`app/api/routes/chat.py:111`(同步 chat)、`chat.py:176`(SSE error 事件)、`app/api/routes/settings.py:56` 均把异常原文作为 detail 返回。信息安全隐患。

### Suggested Action
在 `app/main.py` 注册全局 `ExceptionHandler`，统一返回 `{error, request_id}`，详情仅 `logger.exception`；SSE 的 `except` 改 `yield _sse("error", {"detail":"服务内部错误"})`。

### Metadata
- Source: architect-review (software-architect, 2026-07-14)
- Related Files: backend/app/api/routes/chat.py, backend/app/api/routes/settings.py, backend/app/main.py
- Tags: security,exception-handling
- Pattern-Key: harden.no_leak_exceptions
- Recurrence-Count: 1

---

## [LRN-20260714-002] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: critical
**Status**: pending
**Area**: backend

### Summary
上传校验形同虚设：扩展名不在白名单时仅改名而非拒绝，且无大小上限、无真实 MIME 校验。

### Details
`app/api/routes/students.py:400-407` 的 `_ALLOWED_EXT` 命中失败时 `ext=".png"` 改名放行；`file.read()` 全量读入内存，无 `MAX_CONTENT_LENGTH`。任意字节可落盘 `/uploads/<mid>.png`，存在存储/DoS 风险。比 2026-07-11 记录更严重。

### Suggested Action
不匹配即 `HTTP 400` 拒绝；加 `MAX_UPLOAD_MB` 并在读取前校验 `content-length`；校验 PNG/JPEG 魔数（前 4–8 字节）；上传目录禁用脚本执行/MIME 嗅探。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/api/routes/students.py
- Tags: security,upload,validation
- Pattern-Key: harden.upload_validation
- Recurrence-Count: 1

---

## [LRN-20260714-003] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
getDashboard 无去重缓存：在线 `request()` 无缓存，4+ 视图各自 useEffect 拉取，切 Tab/refreshKey 变更即重复并发。

### Details
`lib/api.ts:200-209` request 无 cache；调用点 OverviewView:70 / TwinView:36 / GraphView:32 / DiagnosisView:37 / page.tsx:215。同一学生同会话重复 4+ 次相同请求，每次全量重算 twin/radar。

### Suggested Action
在 `WorkspaceInner` 统一 fetch 后经 props/context 下发；或加 `Map<studentId, Promise<Dashboard>>` 去重 + 短 TTL 内存缓存（离线已有 mockCache，在线补齐）。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: frontend/lib/api.ts, frontend/app/page.tsx, frontend/components/views/*.tsx
- Tags: performance,caching,dedup
- Pattern-Key: frontend.cache_dedup
- Recurrence-Count: 1
- See Also: LRN-20260711-001

---

## [LRN-20260714-004] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
领域服务层缺失：twin→radar/readiness/board_mastery 计算散落路由层且复制两份。

### Details
`_twin_to_radar`/`_readiness` 在 `chat.py:40,52` 与 `students.py:67,78` 各复制一份；`_apply_student_update` 仅 `chat.py:61`。易逻辑漂移、难测试。

### Suggested Action
新建 `app/domain/assessment.py` 集中 twin→radar、readiness、board_mastery、growth 维护与 `_apply_student_update`，路由改为调用。顺带修 P2 雷达命名错位。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/api/routes/chat.py, backend/app/api/routes/students.py
- Tags: architecture,service-layer,refactor
- Pattern-Key: backend.domain_service_layer
- Recurrence-Count: 1

---

## [LRN-20260714-005] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: cross

### Summary
常量无单一来源：存在多份 `NINE_DIMS`，且离线 mock 与后端 canonical 的九维 key 命名不一致（boards 数量也不一致）。

### Details
canonical `app/models.py:19`(concept/modeling/…)、`lib/pomosData.ts:13`(knowledgeMastery/…)、`lib/offlineApi.ts:285`(mech/em/…)；boards 离线 6（含数学方法）vs 后端 5。离线 demo 与在线后端的九维标签完全不一样，用户体验割裂。

### Suggested Action
以 `models.py` 为准，前端/离线 import 或建映射层；离线 mock 九维 key 对齐后端 canonical；boards 统一为 5。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/models.py, frontend/lib/pomosData.ts, frontend/lib/offlineApi.ts
- Tags: constants,consistency,offline
- Pattern-Key: config.single_source_constants
- Recurrence-Count: 1

---

## [LRN-20260714-006] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
死代码：`getStudent`/`getAssessment` 定义但前端从未调用；`Assessment` 类型亦未使用；`MODULE_STATUS.m04.file` 注释错误。

### Details
`lib/api.ts:243,333,126`；`lib/offlineApi.ts:439,498`；`lib/pomosData.ts:289`(m04.file 写成 chat.py，应为 modules/m04_student_model.py)。

### Suggested Action
删除未用导出与 `Assessment` 类型；修正 `MODULE_STATUS` 文档注释。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: frontend/lib/api.ts, frontend/lib/offlineApi.ts, frontend/lib/pomosData.ts
- Tags: dead-code,cleanup
- Pattern-Key: simplify.dead_code
- Recurrence-Count: 1

---

## [LRN-20260714-007] correction

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
SSE 无中断机制：`streamChat` 无 AbortController，切 Tab 时 reader 仍在跑并对已卸载视图 setState。

### Details
`lib/api.ts:278`(streamChat 无 abort)；`app/page.tsx:139-200`(handleSend 未传 abort；ChatView/ChatWindow 无 cleanup)。资源浪费、潜在内存泄漏。

### Suggested Action
暴露 `abort()`，切视图/`handleSend` 重入时调用；offline `streamChat` 用可取消的 `Promise.race`/flag。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: frontend/lib/api.ts, frontend/app/page.tsx, frontend/components/chat/*
- Tags: sse,abort,memory-leak
- Pattern-Key: harden.sse_abort
- Recurrence-Count: 1

---

## [LRN-20260714-008] insight

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: backend

### Summary
twin→radar 语义命名错位：`knowledge←concept`、`scientific_thinking←experiment` 等映射与维度名不符。

### Details
`chat.py:40`、`students.py:67`。疑似 m14 规范约定，需确认是否故意。

### Suggested Action
若为规范意图则保留并加注释；否则重命名映射键使其自解释。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/api/routes/chat.py, backend/app/api/routes/students.py
- Tags: naming,semantics
- Recurrence-Count: 1

---

## [LRN-20260714-009] insight

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: backend

### Summary
`/assessment` 端点冗余：前端只用 `/dashboard`，`/assessment` 基本不被调用，维护双份聚合逻辑。

### Details
`students.py:150`。

### Suggested Action
保留作公开 API 或合并进 dashboard（T3 抽服务层时一并决定）。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/api/routes/students.py
- Tags: api,redundancy
- Recurrence-Count: 1

---

## [LRN-20260714-010] insight

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
`cors_origins` 运行时修改无效：CORS 中间件启动时按 `settings` 构建一次，PUT /settings 改内存但不生效。

### Details
`config.py:56`(cors_origin_list)、`main.py:23`。设置面板误导用户。

### Suggested Action
文档注明需重启，或改为依赖 `app.state` 动态读取。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: backend/app/config.py, backend/app/main.py
- Tags: cors,config
- Recurrence-Count: 1

---

## [LRN-20260714-011] insight

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
调试日志残留：1 处 `console.error` 在生产噪音。

### Details
`components/settings/SettingsPanel.tsx:223`。

### Suggested Action
删除或改结构化日志。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: frontend/components/settings/SettingsPanel.tsx
- Tags: logging,cleanup
- Recurrence-Count: 1

---

## [LRN-20260714-012] insight

**Logged**: 2026-07-14T14:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
长列表未虚拟化：ChatWindow/MistakesView 全量渲染；当前数据量小收益低。

### Details
`components/chat/ChatWindow.tsx:28`、`components/views/MistakesView.tsx:222`。

### Suggested Action
当前可暂缓；若做，引入 `react-window` 或分页/分片加载。

### Metadata
- Source: architect-review (2026-07-14)
- Related Files: frontend/components/chat/ChatWindow.tsx, frontend/components/views/MistakesView.tsx
- Tags: performance,virtualization
- Recurrence-Count: 1

---
