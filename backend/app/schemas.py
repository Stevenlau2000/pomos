"""Pydantic 请求/响应模型。

前端将严格按本文件定义的契约对接，需与 API 路由返回结构保持对齐。
"""
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------- Chat ----------------
class ChatRequest(BaseModel):
    """POST /api/chat 请求体。"""

    student_id: str = Field(..., description="学生 ID")
    message: str = Field(..., description="用户输入消息")
    session_id: Optional[str] = Field(None, description="会话 ID，缺省自动生成")


class ModuleTraceItem(BaseModel):
    """module_trace 中单条调用记录。"""

    module: str
    action: str
    ts: int  # unix 时间戳（秒）


class StudentUpdate(BaseModel):
    """可选的学生画像更新（来自评估引擎，每次对话产出）。"""

    pq: float
    mastery_delta: dict[str, float] = Field(default_factory=dict)
    weak_concepts: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """POST /api/chat 响应体。"""

    session_id: str
    reply: str
    module_trace: list[ModuleTraceItem]
    student_update: Optional[StudentUpdate] = None


# ---------------- Chat history ----------------
class HistoryItem(BaseModel):
    """单条历史消息。"""

    role: str  # "user" | "assistant"
    content: str
    created_at: Any


class ChatHistoryResponse(BaseModel):
    """GET /api/chat/history 响应体。"""

    messages: list[HistoryItem]


# ---------------- Students ----------------
class StudentCreate(BaseModel):
    """POST /api/students 请求体。"""

    name: str
    grade: Optional[str] = None


class StudentOut(BaseModel):
    """学生及其九维 Student Twin。"""

    student_id: str
    name: str
    grade: Optional[str] = None
    created_at: Any
    twin: dict[str, float] = Field(default_factory=dict)


class StudentProfileUpdate(BaseModel):
    """PUT /api/students/{id} 请求体：更新学生基础信息。"""

    name: Optional[str] = None
    grade: Optional[str] = None


class AssessmentOut(BaseModel):
    """GET /api/students/{id}/assessment 响应体。"""

    pq: float
    radar: dict[str, float]
    growth_curve: list[dict[str, Any]] = Field(default_factory=list)
    readiness: dict[str, float]


# ---------------- Dashboard（聚合视图数据） ----------------
class NineDimOut(BaseModel):
    """九维画像单维（0~1 归一化）。"""

    key: str
    label: str
    value: float
    hint: str


class DashboardOut(BaseModel):
    """GET /api/students/{id}/dashboard 响应体（聚合总览/孪生/诊断/图谱所需）。"""

    student_id: str
    name: str
    grade: Optional[str] = None
    pq: float  # 0~1
    radar: dict[str, float]  # 0~1
    growth_curve: list[dict[str, Any]] = Field(default_factory=list)
    readiness: dict[str, float]  # 0~1
    twin: list[NineDimOut] = Field(default_factory=list)
    weak_concepts: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    board_mastery: dict[str, float] = Field(default_factory=dict)  # 0~1，按板块


# ---------------- Training（训练编排） ----------------
class TrainingWeekOut(BaseModel):
    """AOCS 周计划单周。"""

    week: int
    focus: str
    items: list[str] = Field(default_factory=list)
    load: int


class DailyPlanOut(BaseModel):
    """ALOE 今日规划单项。"""

    time: str
    task: str
    type: str
    priority: int


class TrainingOut(BaseModel):
    """GET /api/students/{id}/training 响应体。"""

    weekly: list[TrainingWeekOut] = Field(default_factory=list)
    today: list[DailyPlanOut] = Field(default_factory=list)
    rationale: str = ""


# ---------------- Mistakes（错题本） ----------------
class MistakeOut(BaseModel):
    """错题条目。"""

    id: str
    topic: str
    summary: str
    bug_id: Optional[str] = None
    status: str
    recurrence: int
    created_at: Any
    image_path: Optional[str] = None  # 题目原图相对 URL
    analysis: Optional[str] = None  # 题目解析 / 正确思路


class MistakeCreate(BaseModel):
    """POST /api/students/{id}/mistakes 请求体。"""

    topic: str
    summary: str
    bug_id: Optional[str] = None
    status: Optional[str] = "未掌握"
    analysis: Optional[str] = None


class MistakeUpdate(BaseModel):
    """PATCH /api/students/{id}/mistakes/{mid} 请求体。"""

    status: Optional[str] = None
    summary: Optional[str] = None
    analysis: Optional[str] = None

