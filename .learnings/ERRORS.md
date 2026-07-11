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
