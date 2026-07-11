"""学生路由：创建/查询学生、能力评估、聚合仪表盘、训练编排与错题本。

POST   /api/students
GET    /api/students/{student_id}
PUT    /api/students/{student_id}
GET    /api/students/{student_id}/assessment
GET    /api/students/{student_id}/dashboard      # 聚合总览/孪生/诊断/图谱数据
GET    /api/students/{student_id}/training        # 个性化训练计划
GET    /api/students/{student_id}/mistakes        # 错题本
POST   /api/students/{student_id}/mistakes
PATCH  /api/students/{student_id}/mistakes/{mid}
DELETE /api/students/{student_id}/mistakes/{mid}
"""
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.models import SIX_RADAR, NINE_DIM_META, BOARD_MASTERY_MAP
from app.modules.training_plan import build_training_plan
from app.schemas import (
    StudentCreate,
    StudentOut,
    AssessmentOut,
    StudentProfileUpdate,
    DashboardOut,
    NineDimOut,
    TrainingOut,
    TrainingWeekOut,
    DailyPlanOut,
    MistakeOut,
    MistakeCreate,
    MistakeUpdate,
)

router = APIRouter(tags=["students"])

# 错题图片存储根目录（backend/uploads）
UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
_ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


def _to_student_out(s: "models.Student") -> StudentOut:
    """ORM Student -> 响应模型。"""
    return StudentOut(
        student_id=s.student_id,
        name=s.name,
        grade=s.grade,
        created_at=s.created_at,
        twin=s.twin or {},
    )


def _latest_assessment(db: Session, student_id: str) -> "Optional[models.Assessment]":
    return (
        db.query(models.Assessment)
        .filter(models.Assessment.student_id == student_id)
        .order_by(models.Assessment.created_at.desc())
        .first()
    )


def _twin_to_radar(twin: dict) -> dict:
    return {
        "knowledge": twin.get("concept", 0.0),
        "modeling": twin.get("modeling", 0.0),
        "scientific_thinking": twin.get("experiment", 0.0),
        "transfer": twin.get("transfer", 0.0),
        "competition": twin.get("competition", 0.0),
        "growth": twin.get("growth", 0.0),
    }


def _readiness(pq: float) -> dict:
    return {
        "province_top": round(min(1.0, pq), 3),
        "province_team": round(min(1.0, max(0.0, pq - 0.15)), 3),
        "ipho": round(min(1.0, max(0.0, pq - 0.35)), 3),
    }


@router.post("/students", response_model=StudentOut)
def create_student(body: StudentCreate, db: Session = Depends(get_db)) -> StudentOut:
    """创建新学生（初始化九维 Student Twin 为 0）。"""
    s = models.Student(name=body.name, grade=body.grade)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_student_out(s)


@router.get("/students", response_model=list[StudentOut])
def list_students(db: Session = Depends(get_db)) -> list[StudentOut]:
    """列出所有未删除的学生（按创建时间降序），供前端学生切换器使用。"""
    rows = (
        db.query(models.Student)
        .filter(models.Student.deleted_at.is_(None))
        .order_by(models.Student.created_at.desc())
        .all()
    )
    return [_to_student_out(s) for s in rows]


@router.delete("/students/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db)) -> dict:
    """软删除学生，并级联清理其对话 / 评估 / 错题，避免孤儿数据。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    from datetime import datetime, timezone

    s.deleted_at = datetime.now(timezone.utc)
    db.query(models.Message).filter(models.Message.student_id == student_id).delete()
    db.query(models.Assessment).filter(models.Assessment.student_id == student_id).delete()
    db.query(models.Mistake).filter(models.Mistake.student_id == student_id).delete()
    db.commit()
    return {"ok": True, "deleted": student_id}


@router.get("/students/{student_id}", response_model=StudentOut)
def get_student(student_id: str, db: Session = Depends(get_db)) -> StudentOut:
    """按 ID 查询学生及其九维画像。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return _to_student_out(s)


@router.put("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: str, body: StudentProfileUpdate, db: Session = Depends(get_db)
) -> StudentOut:
    """更新学生基础信息（姓名 / 年级）。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    if body.name is not None:
        s.name = body.name
    if body.grade is not None:
        s.grade = body.grade
    db.commit()
    db.refresh(s)
    return _to_student_out(s)


@router.get("/students/{student_id}/assessment", response_model=AssessmentOut)
def get_assessment(student_id: str, db: Session = Depends(get_db)) -> AssessmentOut:
    """返回学生综合物理能力评估（HPCAS/PQ）。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")

    record = _latest_assessment(db, student_id)
    if record is not None:
        return AssessmentOut(
            pq=record.pq,
            radar=record.radar or {k: 0.0 for k in SIX_RADAR},
            growth_curve=record.growth_curve or [],
            readiness=record.readiness or {
                "province_top": 0.0,
                "province_team": 0.0,
                "ipho": 0.0,
            },
        )

    twin = s.twin or {}
    radar = _twin_to_radar(twin)
    pq = round(sum(radar.values()) / len(radar), 3) if radar else 0.0
    return AssessmentOut(
        pq=pq,
        radar=radar,
        growth_curve=[],
        readiness={"province_top": 0.5, "province_team": 0.3, "ipho": 0.1},
    )


@router.get("/students/{student_id}/dashboard", response_model=DashboardOut)
def get_dashboard(student_id: str, db: Session = Depends(get_db)) -> DashboardOut:
    """聚合总览/数字孪生/诊断/知识图谱所需数据。

    由 Student Twin 与最新一轮 Assessment（含 pq / weak_concepts / recommendations）
    汇总得到。画像与评估随对话实时演进。
    """
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")

    twin = dict(s.twin or {dim: 0.0 for dim in models.NINE_DIMS})
    twin_out = [
        NineDimOut(
            key=dim,
            label=NINE_DIM_META.get(dim, {}).get("label", dim),
            value=round(float(twin.get(dim, 0.0)), 3),
            hint=NINE_DIM_META.get(dim, {}).get("hint", ""),
        )
        for dim in models.NINE_DIMS
    ]

    record = _latest_assessment(db, student_id)
    if record is not None:
        pq = record.pq
        radar = record.radar or _twin_to_radar(twin)
        growth_curve = record.growth_curve or []
        readiness = record.readiness or _readiness(pq)
        weak = record.weak_concepts or []
        recs = record.recommendations or []
    else:
        radar = _twin_to_radar(twin)
        pq = round(sum(radar.values()) / len(radar), 3) if radar else 0.0
        growth_curve = []
        readiness = _readiness(pq)
        weak = []
        recs = []

    # 由 twin 推导各板块掌握度（知识图谱着色用）
    board_mastery = {}
    for board, dims in BOARD_MASTERY_MAP.items():
        vals = [float(twin.get(d, 0.0)) for d in dims]
        board_mastery[board] = round(sum(vals) / len(vals), 3) if vals else 0.0

    return DashboardOut(
        student_id=s.student_id,
        name=s.name,
        grade=s.grade,
        pq=pq,
        radar=radar,
        growth_curve=growth_curve,
        readiness=readiness,
        twin=twin_out,
        weak_concepts=weak,
        recommendations=recs,
        board_mastery=board_mastery,
    )


@router.get("/students/{student_id}/training", response_model=TrainingOut)
def get_training(student_id: str, db: Session = Depends(get_db)) -> TrainingOut:
    """返回个性化训练计划（AOCS 周计划 + ALOE 今日规划）。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")

    twin = dict(s.twin or {dim: 0.0 for dim in models.NINE_DIMS})
    record = _latest_assessment(db, student_id)
    weak = record.weak_concepts if record else []
    recs = record.recommendations if record else []

    plan = build_training_plan(twin, weak or [], recs or [])
    return TrainingOut(
        weekly=[TrainingWeekOut(**w) for w in plan["weekly"]],
        today=[DailyPlanOut(**d) for d in plan["today"]],
        rationale=plan["rationale"],
    )


# ---------------- 错题本 ----------------
@router.get("/students/{student_id}/mistakes", response_model=list[MistakeOut])
def list_mistakes(student_id: str, db: Session = Depends(get_db)) -> list[MistakeOut]:
    """列出该学生的错题本（按创建时间降序）。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    rows = (
        db.query(models.Mistake)
        .filter(models.Mistake.student_id == student_id)
        .order_by(models.Mistake.created_at.desc())
        .all()
    )
    return [
        MistakeOut(
            id=m.id,
            topic=m.topic,
            summary=m.summary,
            bug_id=m.bug_id,
            status=m.status,
            recurrence=len(m.recurrence) if isinstance(m.recurrence, list) else int(m.recurrence or 0),
            created_at=m.created_at,
            image_path=m.image_path,
            analysis=m.analysis,
        )
        for m in rows
    ]


@router.post("/students/{student_id}/mistakes", response_model=MistakeOut)
def create_mistake(
    student_id: str, body: MistakeCreate, db: Session = Depends(get_db)
) -> MistakeOut:
    """新增一条错题（可来自诊断视图的误区检测或手动录入）。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    m = models.Mistake(
        student_id=student_id,
        topic=body.topic,
        summary=body.summary,
        bug_id=body.bug_id,
        status=body.status or "未掌握",
        recurrence=[],
        analysis=body.analysis,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return MistakeOut(
        id=m.id,
        topic=m.topic,
        summary=m.summary,
        bug_id=m.bug_id,
        status=m.status,
        recurrence=0,
        created_at=m.created_at,
        image_path=m.image_path,
        analysis=m.analysis,
    )


@router.patch("/students/{student_id}/mistakes/{mid}", response_model=MistakeOut)
def update_mistake(
    student_id: str,
    mid: str,
    body: MistakeUpdate,
    db: Session = Depends(get_db),
) -> MistakeOut:
    """更新错题状态（如 未掌握→巩固中→已掌握）或摘要。"""
    m = (
        db.query(models.Mistake)
        .filter(models.Mistake.id == mid, models.Mistake.student_id == student_id)
        .first()
    )
    if m is None:
        raise HTTPException(status_code=404, detail="错题不存在")
    from datetime import datetime, timezone

    if body.status is not None:
        m.status = body.status
        if body.status == "已掌握":
            m.resolved_at = datetime.now(timezone.utc)
    if body.summary is not None:
        m.summary = body.summary
    if body.analysis is not None:
        m.analysis = body.analysis
    db.commit()
    db.refresh(m)
    return MistakeOut(
        id=m.id,
        topic=m.topic,
        summary=m.summary,
        bug_id=m.bug_id,
        status=m.status,
        recurrence=len(m.recurrence) if isinstance(m.recurrence, list) else int(m.recurrence or 0),
        created_at=m.created_at,
        image_path=m.image_path,
        analysis=m.analysis,
    )


@router.delete("/students/{student_id}/mistakes/{mid}")
def delete_mistake(student_id: str, mid: str, db: Session = Depends(get_db)) -> dict:
    """删除一条错题。"""
    m = (
        db.query(models.Mistake)
        .filter(models.Mistake.id == mid, models.Mistake.student_id == student_id)
        .first()
    )
    if m is None:
        raise HTTPException(status_code=404, detail="错题不存在")
    db.delete(m)
    db.commit()
    return {"ok": True, "deleted": mid}


# ---------------- 错题多模态：题目原图上传 ----------------
@router.post("/students/{student_id}/mistakes/{mid}/image")
async def upload_mistake_image(
    student_id: str,
    mid: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """上传该错题的题目原图（png/jpg/...），保存后返回可访问的相对 URL。"""
    s = db.get(models.Student, student_id)
    if s is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    m = (
        db.query(models.Mistake)
        .filter(models.Mistake.id == mid, models.Mistake.student_id == student_id)
        .first()
    )
    if m is None:
        raise HTTPException(status_code=404, detail="错题不存在")

    raw_name = file.filename or "image"
    _, ext = os.path.splitext(raw_name)
    ext = ext.lower()
    if ext not in _ALLOWED_EXT:
        ext = ".png"
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    fname = f"{mid}{ext}"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    (UPLOAD_ROOT / fname).write_bytes(content)
    m.image_path = f"/uploads/{fname}"
    db.commit()
    return {"image_path": m.image_path}
