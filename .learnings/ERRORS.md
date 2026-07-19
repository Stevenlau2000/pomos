# Errors

Command failures and integration errors.

---

## [ERR-20260711-001] growth_curve_unbounded / history_no_pagination

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Assessment.growth_curve 无限增长 + /api/chat/history 无分页，长生命周期下 DB 与响应体持续膨胀。

### Error
```text
backend/app/api/routes/chat.py:81
    rec.growth_curve = (rec.growth_curve or []) + [{"ts": int(time.time()), "pq": pq}]
# 每次对话都追加，无裁剪上限
backend/app/api/routes/chat.py:185-201  chat_history()
    rows = query.order_by(...).all()   # 无 limit/offset，学生对话越多越慢、JSON 列越大
```

### Context
- 自适应闭环每轮把新 pq 点 push 进 growth_curve；SQLite 存为 JSON 文本，字符串越来越长。
- 历史接口一次性返回全部 Message，无分页。

### Suggested Fix
- growth_curve 只保留最近 N 点（如 200），超长截断。
- history 增加 `limit`/`offset` 查询参数并默认限制（如 100 条/页）。

### Metadata
- Reproducible: yes
- Related Files: backend/app/api/routes/chat.py, backend/app/models.py
- See Also: FEAT-20260711-003

---

## [ERR-20260711-002] secrets_plaintext_not_gitignored

**Logged**: 2026-07-11T00:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
API 密钥以明文写入 runtime_settings.json，且该文件未被 .gitignore 覆盖，存在密钥泄露风险。

### Error
```text
backend/app/config.py:107-114  _persist_runtime_settings()
    json.dump({k: getattr(settings,k) for k in _RUNTIME_WRITABLE ...})  # 含 7 个 *_api_key
# 实测 backend/runtime_settings.json 存在且为明文；.gitignore 未忽略该文件
```

### Context
- 前端设置面板保存 API key 时落盘明文。
- .gitignore 已忽略 .env / *.db / 上传产物，但漏了 runtime_settings.json 与 uploads/。

### Suggested Fix
- .gitignore 增加 `backend/runtime_settings.json`、`backend/uploads/`。
- 落盘权限 0600；密钥经由环境变量/密钥库注入，json 仅存非敏感项。

### Metadata
- Reproducible: yes
- Related Files: backend/app/config.py, .gitignore
- See Also: LRN-20260711-002

---

## [ERR-20260718-001] backend_chat_uuid_nameerror

**Logged**: 2026-07-18T15:40:00+08:00
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
`app/api/routes/chat.py` L56/L95/L155 调用 `uuid.uuid4()`，但文件未 `import uuid`（仅 orchestrator/main/settings 导入）。当 `request.state.request_id` 缺失或进入 except 兜底分支时触发 `NameError`，掩盖真实异常、污染日志。

### Error
```
NameError: name 'uuid' is not defined
```

### Context
- 文件：backend/app/api/routes/chat.py
- 复现：请求未携带 request_id 中间件注入时进入兜底分支即报错

### Suggested Fix
在 chat.py 顶部加 `import uuid`（一行修复）。

### Metadata
- Reproducible: yes
- Related Files: backend/app/api/routes/chat.py
- Tags: backend, bug, import-missing

---

## [ERR-20260718-002] frontend_offline_stream_no_signal

**Logged**: 2026-07-18T15:40:00+08:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
`lib/api.ts` 的 `streamChat` 在 `offlineMode()` 分支（L309）调用 `offline.streamChat(input, handlers)` 未透传 `signal`；离线分支的 `for` 循环（`await sleep(16)`）不可中止。用户切视图/重发时 `abort()` 无法取消旧流，导致两条回复内容交错、顶栏评估被覆盖。

### Context
- 文件：frontend/lib/api.ts:309；frontend/lib/offlineApi.ts streamChat
- online 分支（L315）已传 signal，离线分支遗漏

### Suggested Fix
给 `offlineApi.streamChat` 增加 `signal` 参数，循环每次检查 `signal?.aborted`；`api.ts:309` 透传 `signal`。

### Metadata
- Reproducible: yes
- Related Files: frontend/lib/api.ts, frontend/lib/offlineApi.ts
- Tags: frontend, streaming, abort, concurrency

---
