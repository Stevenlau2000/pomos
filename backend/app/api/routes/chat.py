"""对话路由：POST /api/chat（持久化）与 GET /api/chat/history（历史）。

职责：
- 调用 Runtime Orchestrator 得到回复与 module_trace；
- 将 user/assistant 消息落库（Message 表），实现多轮可回溯；
- 若编排结果含 student_update（评估类模块产出 pq / mastery_delta），
  则累加到 Student.twin 并 upsert Assessment，闭合「自适应学习循环」；
- 提供历史查询接口，供前端 ChatView 加载既有对话；
- POST /api/chat/stream 提供 SSE 流式对话（打字机式实时输出）。
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.memory import remember_turn
from app.orchestrator import run_orchestrator, stream_orchestrator
from app.schemas import ChatRequest, ChatHistoryResponse, HistoryItem
from app.domain.assessment import twin_to_radar, readiness, apply_student_update

router = APIRouter(tags=["chat"])

logger = logging.getLogger(__name__)


def _sse(event: str, data: dict) -> str:
    """构造一条 SSE 报文（event 行 + data JSON 行 + 空行分隔）。"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    """接收学生消息，经 Runtime Orchestrator 编排后返回回复与调用轨迹，并落库。"""
    # 确保学生存在（前端可能尚未在设置里保存画像），否则懒建默认学生，
    # 这样对话历史与评估才能落库，闭合自适应闭环。
    student = db.get(models.Student, req.student_id)
    if student is None:
        student = models.Student(student_id=req.student_id, name="学员")
        db.add(student)
        db.flush()
    twin = dict(student.twin or {dim: 0.0 for dim in models.NINE_DIMS})
    remember_turn(req.student_id, "user", req.message)

    try:
        result = await run_orchestrator(
            req.student_id, req.message, req.session_id, twin=twin
        )
    except Exception as exc:  # noqa: BLE001
        request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
        logger.exception(
            "对话编排失败 student_id=%s request_id=%s", req.student_id, request_id
        )
        # 安全加固（P0-1）：对外只返回通用 500，不泄露内部异常原文
        raise HTTPException(status_code=500)

    session_id = result["session_id"]
    db.add(models.Message(
        student_id=req.student_id, session_id=session_id,
        role="user", content=req.message,
    ))
    db.add(models.Message(
        student_id=req.student_id, session_id=session_id,
        role="assistant", content=result["reply"],
    ))
    remember_turn(req.student_id, "assistant", result["reply"])
    apply_student_update(db, req.student_id, result.get("student_update"))
    db.commit()
    return result


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, request: Request, db: Session = Depends(get_db)) -> StreamingResponse:
    """SSE 流式对话：逐字推送导师回复，结束前完成消息落库与自适应闭环更新。

    事件流：meta -> delta×N -> assessment -> done。
    落库（user/assistant 消息 + student_update 累加）在收到 done 事件后执行，
    与同步 /chat 端点保持完全一致的持久化与闭环语义。
    """
    # 懒建学生，确保对话与评估能落库
    student = db.get(models.Student, req.student_id)
    if student is None:
        student = models.Student(student_id=req.student_id, name="学员")
        db.add(student)
        db.flush()
    twin = dict(student.twin or {dim: 0.0 for dim in models.NINE_DIMS})
    remember_turn(req.student_id, "user", req.message)

    request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())

    async def event_generator():
        final = None
        collected_reply = ""          # 累积的回复全文（断流时用于兜底落库）
        collected_update = None        # 累积的评估（断流时用于兜底落库）
        sid = req.session_id
        errored = False
        try:
            async for ev in stream_orchestrator(
                req.student_id, req.message, req.session_id, twin=twin
            ):
                etype = ev.get("type")
                if etype == "delta":
                    collected_reply += ev.get("text", "")
                    yield _sse("delta", {"text": ev.get("text", "")})
                elif etype == "meta":
                    sid = ev.get("session_id") or sid
                    yield _sse("meta", {
                        "session_id": ev.get("session_id"),
                        "module_trace": ev.get("module_trace", []),
                        "intent": ev.get("intent"),
                    })
                elif etype == "assessment":
                    collected_update = ev.get("student_update")
                    yield _sse("assessment", {"student_update": collected_update})
                elif etype == "done":
                    final = ev
                    collected_reply = ev.get("reply", collected_reply)
                    collected_update = ev.get("student_update", collected_update)
                    yield _sse("done", {"session_id": ev.get("session_id")})
        except Exception as exc:  # noqa: BLE001
            errored = True
            logger.exception(
                "SSE 对话流异常 student_id=%s request_id=%s",
                req.student_id, request_id,
            )
            # 安全加固（P0-1）：SSE 错误事件只给通用提示，绝不透传异常原文
            yield _sse("error", {"detail": "服务内部错误"})
            return

        # 落库：无论正常结束还是客户端中途断开（GeneratorExit），都尽量持久化，
        # 避免「流式中途断开 → 消息不入库」的数据丢失（与 /chat 保持一致的闭环语义）。
        try:
            if errored:
                return
            if final is not None:
                remember_turn(req.student_id, "assistant", final["reply"])
                db.add(models.Message(
                    student_id=req.student_id, session_id=final["session_id"],
                    role="user", content=req.message,
                ))
                db.add(models.Message(
                    student_id=req.student_id, session_id=final["session_id"],
                    role="assistant", content=final["reply"],
                ))
                apply_student_update(db, req.student_id, final.get("student_update"))
                db.commit()
            elif collected_reply:
                # 客户端中途断开：用已累积内容兜底落库
                persist_sid = sid or req.session_id or str(uuid.uuid4())
                remember_turn(req.student_id, "assistant", collected_reply)
                db.add(models.Message(
                    student_id=req.student_id, session_id=persist_sid,
                    role="user", content=req.message,
                ))
                db.add(models.Message(
                    student_id=req.student_id, session_id=persist_sid,
                    role="assistant", content=collected_reply,
                ))
                apply_student_update(db, req.student_id, collected_update or {})
                db.commit()
        except Exception:  # noqa: BLE001
            # 落库失败不应影响响应关闭
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/history", response_model=ChatHistoryResponse)
def chat_history(
    student_id: str = Query(..., description="学生 ID"),
    session_id: Optional[str] = Query(None, description="可选：限定某会话"),
    limit: int = Query(200, ge=0, description="返回条数上限，0 表示不限制"),
    offset: int = Query(0, ge=0, description="偏移量（基于倒序取最近一批后计算）"),
    db: Session = Depends(get_db),
) -> ChatHistoryResponse:
    """返回某学生的对话历史（可选按 session 过滤），分页返回，按时间升序。

    默认返回最近 200 条（limit=200）；先按时间倒序取最近一批再反转为升序展示，
    避免长生命周期下一次性拉取全表导致响应体无限膨胀。
    """
    query = db.query(models.Message).filter(models.Message.student_id == student_id)
    if session_id:
        query = query.filter(models.Message.session_id == session_id)
    rows = query.order_by(models.Message.created_at.desc()).all()
    if limit and limit > 0:
        rows = rows[offset:offset + limit]
    rows = list(reversed(rows))  # 反转为时间升序，便于前端顺序拼接
    return ChatHistoryResponse(
        messages=[
            HistoryItem(role=r.role, content=r.content, created_at=r.created_at)
            for r in rows
        ]
    )
