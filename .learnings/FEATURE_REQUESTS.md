# Feature Requests

Capabilities requested by the user.

---

## [FEAT-20260711-001] multi_tenant_memory

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: high
**Status**: done
**Area**: backend

### Requested Capability
CMOS 记忆按 student_id 分桶隔离，并设容量上限/LRU。

### User Context
当前全局单例使所有学生共享同一记忆池，破坏「个性化记忆」语义，且进程内存只增不减。

### Complexity Estimate
medium

### Suggested Implementation
- `memory.py` 改为 `dict[str, CMOSMemory]`，`get_memory(student_id)` 返回对应桶。
- 写入接口加 maxlen；snapshot 仅返回当前学生桶。
- orchestrator._dispatch 传 student_id 给 get_memory。

### Metadata
- Frequency: first_time
- Related Features: m13_memory_os, orchestrator

---

## [FEAT-20260711-002] sse_tests_and_disconnect_safety

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: done
**Area**: tests

### Requested Capability
补充 /api/chat/stream 端到端测试，并保障客户端断连时仍能落库或显式中止。

### User Context
流式是核心对话链路，当前 pytest 完全未覆盖；断流（final 为 None）会导致消息不落库。

### Complexity Estimate
medium

### Suggested Implementation
- 用 TestClient 以流式方式消费 SSE，断言事件顺序 meta→delta→assessment→done。
- 落库用 try/finally 包裹，确保即使 done 前异常也尽量保存 user/assistant 消息。

### Metadata
- Frequency: first_time
- Related Features: chat_stream, stream_orchestrator

---

## [FEAT-20260711-003] frontend_data_cache

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Requested Capability
前端对 getDashboard 等做请求去重/短缓存，消除切 Tab 时的重复并发请求。

### User Context
Overview/Twin/Graph/Diagnosis 各自调用 getDashboard（5 处），同一 Tab 切换会并发 4 次相同请求；
且每刷新都全量重算 twin/radar/board_mastery。

### Complexity Estimate
medium

### Suggested Action
- 在 page.tsx 顶层统一 fetch dashboard 并下发给各视图（props），或引入轻量缓存（SWR/React Query）。
- 数据上提到 WorkspaceInner 统一缓存，切换视图不重复拉取。

### Metadata
- Frequency: first_time
- Related Features: getDashboard

---

## [FEAT-20260711-004] domain_service_layer

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: backend

### Requested Capability
抽取领域服务层，路由只做 IO，业务逻辑（twin 累加、radar 推导、readiness）下沉。

### User Context
`_twin_to_radar`/`_readiness` 在 chat.py 与 students.py 复制两份（易漂移）；
dashboard/assessment 计算也散落路由层。

### Complexity Estimate
medium

### Suggested Action
- 新建 `app/domain/assessment.py`，集中 twin→radar、readiness、board_mastery、growth 维护。
- chat.py/students.py 改为调用该服务。

### Metadata
- Frequency: first_time
- Related Features: chat.py, students.py

---

## [FEAT-20260711-005] upload_size_mime_check

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: backend

### Requested Capability
错题图片上传加大小上限与 MIME（magic bytes）校验，防恶意大文件打满磁盘。

### User Context
`upload_mistake_image` 仅判空，靠扩展名 `_ALLOWED_EXT` 信任客户端声明。

### Complexity Estimate
simple

### Suggested Action
- 限制 MAX_CONTENT_LENGTH（如 10MB），校验真实文件头（PNG/JPEG 魔数）。

### Metadata
- Frequency: first_time
- Related Features: students.py upload route

---

## [FEAT-20260711-006] single_source_of_truth_constants

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: backend

### Requested Capability
NINE_DIMS / SIX_RADAR / NINE_DIM_META / BOARD_MASTERY_MAP 等常量唯一来源，避免多副本漂移。

### User Context
models.py、m04、assessment_engine.py、前端 pomosData.ts 各定义一份（且 key 命名不一致：
后端 concept…，前端 knowledgeMastery…）。

### Complexity Estimate
simple

### Suggested Action
- 以 models.py 为准，其余 import；前端同步命名或做映射层。

### Metadata
- Frequency: first_time
- Related Features: models, assessment_engine, pomosData

---

## [FEAT-20260711-007] dead_code_cleanup

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Requested Capability
清理未调用的 api 函数与文档漂移。

### User Context
`getStudent`(api.ts:204)、`getAssessment`(api.ts:290) 定义但从未调用；
MODULE_STATUS 中 m04.file 写成 chat.py（实际在 api/routes/chat.py），状态登记与真实接线需复核。

### Complexity Estimate
simple

### Suggested Action
- 删除死代码；修正 MODULE_STATUS 文档注释。

### Metadata
- Frequency: first_time
- Related Features: api.ts, pomosData.ts

---

## [FEAT-20260711-008] sse_abort_cleanup

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Requested Capability
前端 streamChat 增加 AbortController，切换/卸载时终止 reader，避免对卸载组件 setState。

### User Context
api.ts:streamChat 无中断机制；切 Tab 时 reader 仍在跑。

### Complexity Estimate
simple

### Suggested Action
- 暴露 abort()，handleSend 在卸载/新消息时调用。

### Metadata
- Frequency: first_time
- Related Features: streamChat, page.tsx

---

## [FEAT-20260711-009] safe_error_responses

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: low
**Status**: pending
**Area**: backend

### Requested Capability
路由错误不把原始异常原文回传客户端。

### User Context
chat.py:103、settings.py 直接 `raise HTTPException(500, detail=str(exc))`，可能泄露内部路径。

### Complexity Estimate
simple

### Suggested Action
- 统一异常处理器，对外返回通用错误码，详情仅留日志。

### Metadata
- Frequency: first_time
- Related Features: chat.py, settings.py

---

## [FEAT-20260711-010] list_virtualization

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Requested Capability
长列表（ChatWindow / MistakesView / StudentSwitcher）虚拟化。

### User Context
当前全量渲染，长对话/多错题会卡。

### Complexity Estimate
medium

### Suggested Action
- 引入 react-window 或简单分页/分片加载。

### Metadata
- Frequency: first_time
- Related Features: ChatWindow, MistakesView, StudentSwitcher

---

## [FEAT-20260711-BATCH] high_priority_batch_1_to_4

**Logged**: 2026-07-11T10:30:00+08:00
**Priority**: high
**Status**: done
**Area**: backend + tests

### Implemented (用户要求「高优先级打包做掉 #1–#4」)
1. **#1 密钥落盘加固**：`.gitignore` 已忽略 `runtime_settings.json`/`uploads/`（前次）；本次 `config.py._persist_runtime_settings` 写后 `os.chmod(0o600)`，实测文件权限 `-rw-------`。
2. **#2 growth_curve 限长 + history 分页**：`chat.py` 新增 `GROWTH_CURVE_MAX=200`，`_apply_student_update` 仅保留最近 200 点；`chat_history` 增 `limit`(默认200)/`offset` 参数，倒序取最近一批再反转升序。
3. **#3 记忆多租户分片**：`memory.py` 改 `dict[str, CMOSMemory]`，`get_memory(student_id)` 按学生分桶；新增 `remember_turn`（写 working 层，裁剪到 MAX_MEM_TURNS=200）与 `reset_memory`；`orchestrator._dispatch`、`m13_memory_os` 改传 `student_id`；chat 同步/SSE 路由每轮 `remember_turn`。
4. **#4 SSE 测试 + 断流落库**：`chat_stream` 累积 `collected_reply/collected_update`，`finally` 中无论正常结束或 `GeneratorExit` 断流都兜底落库；pytest 新增 `test_chat_stream_events_and_persist`/`test_memory_isolation_and_cap`/`test_growth_curve_capped`。

### Verification
- pytest: **21 passed**（含 3 新增）。
- 端到端：SSE 36 delta + done，history 落库 2 条；`limit=1` 返回 1 条；`runtime_settings.json` 权限 600。
- 后端 8000 在线（venv + --reload 热加载），前端 3000 未改动。

---

## [FEAT-20260718-001] frontend_test_suite

**Logged**: 2026-07-18T15:44:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Requested Capability
为前端引入单元测试框架（建议 vitest），覆盖 8 项升级后新增的纯逻辑，提供回归保护。

### User Context
当前前端 0 测试，离线生成引擎（offlineGen/physicsKB/offlineApi）的任何改动都无自动化验证，易引入回归。

### Complexity Estimate
medium

### Suggested Implementation
- 安装 vitest + @testing-library 可选
- 优先覆盖：offlineGen 全部纯函数、physicsKB 检索/推断、offlineApi 确定性（hashStr/makeRng/buildMockFromTwin）与边界（空 twin/NaN/非法 board）
- 配置 `npm run test` 脚本

### Metadata
- Frequency: first_time
- Related Features: offlineGen.ts, physicsKB.ts, offlineApi.ts

---

## [FEAT-20260718-002] backend_auth_and_ssrf_guard

**Logged**: 2026-07-18T15:44:00+08:00
**Priority**: critical
**Status**: pending
**Area**: backend

### Requested Capability
为后端补认证/授权，并对 `llm_base_url` 等外部地址做 SSRF 防护（网段黑名单）。

### User Context
当前所有端点无任何鉴权，任何人可读写任意学生画像/对话/错题，并可覆写系统级 LLM 密钥与 CORS；`llm_base_url` 无私有网段黑名单，存在 SSRF 窃取云凭据风险。GitHub Pages 静态部署下后端不公开，但本地/内网部署时风险真实。

### Complexity Estimate
complex

### Suggested Implementation
- 加共享密钥/Bearer 中间件或本地回环白名单
- 标记 `PUT /api/settings` 为受保护端点
- `validate_settings` 对 `llm_base_url` 做 DNS 解析并拒绝 RFC1918/169.254.0.0/16/链路本地

### Metadata
- Frequency: first_time
- Related Features: main.py, config.py, settings.py

---
