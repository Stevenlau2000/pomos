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
