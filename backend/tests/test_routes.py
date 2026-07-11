"""接口集成测试：对话持久化、学生 CRUD、错题 CRUD + 图片上传、设置校验。"""
import io


def test_chat_persists_and_assesses(client):
    r = client.post(
        "/api/chat",
        json={"student_id": "stu_chat_1", "message": "请讲讲动量守恒与碰撞"},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["reply"], str) and len(data["reply"]) > 0
    assert data["student_update"] is not None
    assert 0.0 <= data["student_update"]["pq"] <= 1.0

    # 历史落库（user + assistant 两条）
    h = client.get("/api/chat/history", params={"student_id": "stu_chat_1"})
    assert h.status_code == 200
    msgs = h.json()["messages"]
    assert len(msgs) >= 2
    assert msgs[0]["role"] == "user"
    assert msgs[-1]["role"] == "assistant"


def test_settings_validation_endpoint(client):
    bad = client.put("/api/settings", json={"llm_temperature": 9.0})
    assert bad.status_code == 422
    good = client.put("/api/settings", json={"coach_language": "zh"})
    assert good.status_code == 200


def test_student_crud(client):
    created = client.post("/api/students", json={"name": "小明", "grade": "高一"})
    assert created.status_code == 200
    sid = created.json()["student_id"]

    lst = client.get("/api/students")
    assert any(s["student_id"] == sid for s in lst.json())

    upd = client.put(f"/api/students/{sid}", json={"name": "小红", "grade": "高二"})
    assert upd.json()["name"] == "小红"
    assert upd.json()["grade"] == "高二"

    dash = client.get(f"/api/students/{sid}/dashboard")
    assert dash.status_code == 200
    assert "pq" in dash.json()

    # 删除后不再出现在列表
    client.delete(f"/api/students/{sid}")
    lst2 = client.get("/api/students")
    assert not any(s["student_id"] == sid for s in lst2.json())


def test_mistake_crud_and_image(client):
    stu = client.post("/api/students", json={"name": "A"}).json()["student_id"]

    created = client.post(
        f"/api/students/{stu}/mistakes",
        json={"topic": "电磁感应", "summary": "误判感应电流方向", "analysis": "用楞次定律判断"},
    ).json()
    assert created["analysis"] == "用楞次定律判断"
    mid = created["id"]

    lst = client.get(f"/api/students/{stu}/mistakes")
    assert len(lst.json()) == 1
    assert lst.json()[0]["id"] == mid

    # 上传题目原图（multipart）
    img = io.BytesIO(b"\x89PNG\r\n\x1a\n fake-png-bytes")
    up = client.post(
        f"/api/students/{stu}/mistakes/{mid}/image",
        files={"file": ("q.png", img, "image/png")},
    )
    assert up.status_code == 200
    assert up.json()["image_path"].startswith("/uploads/")

    # 图片路径应写回错题
    after = client.get(f"/api/students/{stu}/mistakes").json()[0]
    assert after["image_path"].startswith("/uploads/")

    # 状态流转
    patched = client.patch(
        f"/api/students/{stu}/mistakes/{mid}", json={"status": "巩固中"}
    )
    assert patched.json()["status"] == "巩固中"

    # 删除
    client.delete(f"/api/students/{stu}/mistakes/{mid}")
    assert client.get(f"/api/students/{stu}/mistakes").json() == []


def test_chat_stream_events_and_persist(client):
    """SSE 流式端点：事件顺序正确，且正常结束后对话落库（闭环不丢消息）。"""
    with client.stream(
        "POST",
        "/api/chat/stream",
        json={"student_id": "stu_stream_1", "message": "请讲讲动量守恒与碰撞"},
    ) as r:
        assert r.status_code == 200
        events: list[tuple[str, str]] = []
        cur_event = None
        for line in r.iter_lines():
            if line.startswith("event:"):
                cur_event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                events.append((cur_event, line.split(":", 1)[1].strip()))
    types = [e[0] for e in events]
    assert "meta" in types
    assert "delta" in types
    assert "assessment" in types
    assert "done" in types

    # 正常结束后应落库（user + assistant）
    h = client.get("/api/chat/history", params={"student_id": "stu_stream_1"})
    assert h.status_code == 200
    msgs = h.json()["messages"]
    assert len(msgs) >= 2
    assert msgs[0]["role"] == "user"
    assert msgs[-1]["role"] == "assistant"


def test_memory_isolation_and_cap():
    """记忆按 student_id 隔离，且工作记忆裁剪到 MAX_MEM_TURNS。"""
    from app.memory import remember_turn, get_memory, reset_memory, MAX_MEM_TURNS

    reset_memory("A")
    reset_memory("B")
    for i in range(MAX_MEM_TURNS + 50):
        remember_turn("A", "user", f"a{i}")
        remember_turn("B", "user", f"b{i}")

    a_items = get_memory("A").store.get("working", [])
    b_items = get_memory("B").store.get("working", [])
    # 隔离：A 的工作记忆不含 B 的内容
    assert any(x["content"].startswith("a") for x in a_items)
    assert not any(x["content"].startswith("b") for x in a_items)
    # 限长
    assert len(a_items) == MAX_MEM_TURNS
    assert len(b_items) == MAX_MEM_TURNS
    reset_memory("A")
    reset_memory("B")


def test_growth_curve_capped(db_session):
    """Assessment.growth_curve 应被裁剪到 GROWTH_CURVE_MAX，避免无限增长。"""
    from app.api.routes.chat import _apply_student_update, GROWTH_CURVE_MAX
    from app import models

    sid = "stu_gc"
    db_session.add(models.Student(student_id=sid, name="gc"))
    db_session.commit()
    for i in range(GROWTH_CURVE_MAX + 100):
        _apply_student_update(
            db_session,
            sid,
            {
                "pq": round(0.5 + 0.001 * i, 3),
                "mastery_delta": {"concept": 0.001},
                "weak_concepts": [],
                "recommendations": [],
            },
        )
        db_session.commit()  # 模拟 /chat 路由每轮 commit，使下一轮能查到既有 Assessment
    rec = (
        db_session.query(models.Assessment)
        .filter(models.Assessment.student_id == sid)
        .first()
    )
    assert rec is not None
    assert len(rec.growth_curve) <= GROWTH_CURVE_MAX
