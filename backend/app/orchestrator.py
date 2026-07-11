"""Runtime Orchestrator（基于 LangGraph）。

构建意图分类 → 模块分发 → 响应装配 的有向图。
为保证可导入性，`langgraph` 采用懒加载；若环境未安装，则自动退化为顺序链。
对应 POMOS 规范模块 16_Runtime_Orchestrator（系统大脑）。
"""
import asyncio
import json
import time
import uuid
from typing import Any, Dict, Optional, TypedDict

from app.config import settings
from app.llm import (
    chat_completion,
    chat_completion_stream,
    is_mock,
    offline_tutor,
    _chunk_text,
)
from app.modules import REGISTRY, get_module
from app.modules.assessment_engine import compute_assessment
from app.memory import get_memory

# 意图 -> 主分发模块映射
INTENT_MODULE_MAP: Dict[str, str] = {
    "identity": "m01_identity",
    "mission": "m02_mission",
    "philosophy": "m03_philosophy",
    "student_model": "m04_student_model",
    "diagnosis": "m05_diagnosis",
    "knowledge": "m06_knowledge_graph",
    "thinking": "m07_physics_thinking",
    "strategy": "m08_teaching_strategy",
    "problem": "m09_olympiad_problem",
    "coaching": "m10_olympiad_coaching",
    "inquiry": "m11_scientific_inquiry",
    "learning": "m12_learning_orchestration",
    "memory": "m13_memory_os",
    "assessment": "m14_competency_assessment",
    "multimodal": "m15_multimodal",
    "runtime": "m16_runtime_orchestrator",
}

# 关键词 -> 意图（按优先级从上到下匹配）
_KEYWORD_INTENT: list[tuple[str, str]] = [
    ("身份", "identity"),
    ("你是谁", "identity"),
    ("使命", "mission"),
    ("原则", "mission"),
    ("理念", "philosophy"),
    ("哲学", "philosophy"),
    ("建模", "student_model"),
    ("画像", "student_model"),
    ("诊断", "diagnosis"),
    ("知识图谱", "knowledge"),
    ("图谱", "knowledge"),
    ("知识", "knowledge"),
    ("思维", "thinking"),
    ("策略", "strategy"),
    ("方法", "strategy"),
    ("题目", "problem"),
    ("奥赛", "problem"),
    ("题", "problem"),
    ("辅导", "coaching"),
    ("教练", "coaching"),
    ("实验", "inquiry"),
    ("探究", "inquiry"),
    ("学习", "learning"),
    ("计划", "learning"),
    ("记忆", "memory"),
    ("评估", "assessment"),
    ("测评", "assessment"),
    ("pq", "assessment"),
    ("多模态", "multimodal"),
    ("图片", "multimodal"),
]


def _classify_intent(message: str) -> str:
    """基于规则的意图分类（无 LLM 也能工作）。"""
    text = message or ""
    for keyword, intent in _KEYWORD_INTENT:
        if keyword in text:
            return intent
    return "runtime"


# 尝试导入 LangGraph；失败则标记不可用（退化为顺序链）
try:  # pragma: no cover - 依赖可选
    from langgraph.graph import StateGraph, END  # type: ignore

    LANGGRAPH_AVAILABLE = True
except Exception:  # noqa: BLE001
    LANGGRAPH_AVAILABLE = False


class State(TypedDict):
    """编排图的状态。"""

    student_id: str
    session_id: str
    message: str
    reply: str
    module_trace: list
    student_ctx: dict
    intent: str
    last_result: dict
    twin: dict
    student_update: dict


# ----------------- 节点实现 -----------------
def _classify(state: State) -> State:
    """节点：意图分类。"""
    state["intent"] = _classify_intent(state["message"])
    return state


def _dispatch(state: State) -> State:
    """节点：根据意图调用对应模块，并叠加系统大脑（m16）。"""
    intent = state.get("intent") or _classify_intent(state["message"])
    module_id = INTENT_MODULE_MAP.get(intent, "m16_runtime_orchestrator")

    trace = list(state.get("module_trace") or [])
    student_ctx = dict(state.get("student_ctx") or {})
    ctx: Dict[str, Any] = {
        "student_id": state["student_id"],
        "session_id": state["session_id"],
        "message": state["message"],
        "memory": get_memory(state["student_id"]).snapshot(),
        "student_ctx": student_ctx,
    }

    primary = get_module(module_id)
    result: Optional[Dict[str, Any]] = None
    if primary is not None:
        result = primary.run(ctx)
        trace.append({
            "module": result.get("module", module_id),
            "action": result.get("action", ""),
            "ts": int(time.time()),
        })
        if isinstance(result.get("output"), dict):
            student_ctx.update(result["output"])

    # 系统大脑参与协调
    runtime = get_module("m16_runtime_orchestrator")
    if runtime is not None:
        rres = runtime.run(ctx)
        trace.append({
            "module": rres.get("module", "m16_runtime_orchestrator"),
            "action": rres.get("action", ""),
            "ts": int(time.time()),
        })

    state["module_trace"] = trace
    state["student_ctx"] = student_ctx
    state["last_result"] = result or {}
    return state


def _build_assemble_prompt(state: State) -> tuple[str, str, str]:
    """构造装配节点的 prompt / system / lang。

    _assemble 与 stream_orchestrator 共用，确保流式与非流式回复口径一致。
    """
    result = state.get("last_result") or {}
    output = result.get("output", {})
    summary = json.dumps(output, ensure_ascii=False)[:500]
    lang = (settings.coach_language or "zh").lower()

    if lang == "en":
        lang_instruction = (
            "Reply in English as a physics olympiad (CPhO/IPhO) coach.\n"
            "Be Socratic: first build the physical picture, then derive formulas, "
            "and end with one probing question. Keep it concise."
        )
        system = (
            "You are POMOS, a rigorous yet encouraging physics olympiad mentor. "
            "Never dump formulas without intuition; guide the student to reason."
        )
    else:
        lang_instruction = (
            "请用中文以物理竞赛（CPhO/IPhO）教练的口吻回复。\n"
            "遵循苏格拉底式：先建立物理图像，再推导公式，结尾抛一个启发式追问。"
            "简短、严谨、鼓励，不要直接给最终答案。"
        )
        system = (
            "你是 POMOS，一名严谨而鼓励的中国物理竞赛导师。"
            "不要脱离直觉直接堆公式，要引导学生自己推理。"
        )
    prompt = (
        f"学生说：{state['message']}\n"
        f"模块输出摘要：{summary}\n"
        f"{lang_instruction}"
    )
    return prompt, system, lang


async def _assemble(state: State) -> State:
    """节点：汇总模块输出与记忆，生成自然语言回复。

    - 未配置任何 LLM 密钥时，使用离线物理教练（关键词知识库 + 苏格拉底追问），
      保证零密钥也能给出有实质内容的辅导。
    - 已配置密钥时，调用真实 LLM，并以启发式、先物理图像后公式的方式引导。
    """
    prompt, system, lang = _build_assemble_prompt(state)

    if is_mock():
        state["reply"] = offline_tutor(state["message"], lang)
        return state

    state["reply"] = await chat_completion(prompt, system=system)
    return state


async def _assess(state: State) -> State:
    """节点：基于本轮消息 + 当前画像 + 导师回复，产出个性化评估。

    这是「自适应闭环」真正产生数据的关键一步：
    - 离线（mock）使用确定性启发式（assessment_engine.heuristic_assess）；
    - 在线使用 LLM 结构化评估（assessment_engine.llm_assess）；
    产出 ``student_update``（含 pq / 九维 mastery_delta / weak_concepts / recommendations）。
    """
    lang = (settings.coach_language or "zh").lower()
    twin = dict(state.get("twin") or {})
    state["student_update"] = await compute_assessment(
        state["message"], twin, state["reply"], lang
    )
    return state


# ----------------- 图构建 -----------------
def build_graph():
    """构建并编译 LangGraph 有向图（仅在 langgraph 可用时调用）。"""
    if not LANGGRAPH_AVAILABLE:
        raise RuntimeError("langgraph 不可用，请使用 run_orchestrator 的退化链。")
    graph = StateGraph(State)
    graph.add_node("classify", _classify)
    graph.add_node("dispatch", _dispatch)
    graph.add_node("assemble", _assemble)
    graph.add_node("assess", _assess)
    graph.add_edge("classify", "dispatch")
    graph.add_edge("dispatch", "assemble")
    graph.add_edge("assemble", "assess")
    graph.add_edge("assess", END)
    graph.set_entry_point("classify")
    return graph.compile()


# ----------------- 对外入口 -----------------
async def run_orchestrator(
    student_id: str,
    message: str,
    session_id: Optional[str] = None,
    twin: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """运行编排器，返回与 /api/chat 一致的响应结构。

    Args:
        twin: 学生当前九维画像（来自 DB）。用于评估节点产出个性化的 pq / delta；
              不传则视为全 0 的新手画像。

    Returns:
        ``{"session_id", "reply", "module_trace", "student_update"}``
    """
    sid = session_id or str(uuid.uuid4())
    initial: State = {
        "student_id": student_id,
        "session_id": sid,
        "message": message,
        "reply": "",
        "module_trace": [],
        "student_ctx": {},
        "intent": "",
        "last_result": {},
        "twin": dict(twin or {}),
        "student_update": {},
    }

    if LANGGRAPH_AVAILABLE:
        final = await build_graph().ainvoke(initial)
    else:
        # 退化链：classify -> dispatch -> assemble -> assess
        s = _classify(initial)
        s = _dispatch(s)
        s = await _assemble(s)
        s = await _assess(s)
        final = s

    trace = final.get("module_trace", [])
    student_update = final.get("student_update") or None

    return {
        "session_id": final["session_id"],
        "reply": final["reply"],
        "module_trace": trace,
        "student_update": student_update,
    }


# ----------------- 流式入口 -----------------
async def stream_orchestrator(
    student_id: str,
    message: str,
    session_id: Optional[str] = None,
    twin: Optional[Dict[str, float]] = None,
):
    """流式编排：异步 yield SSE 事件 dict。

    事件顺序：
    1. ``{"type":"meta","session_id","module_trace","intent"}``
    2. ``{"type":"delta","text"}`` ×N（逐块文本增量）
    3. ``{"type":"assessment","student_update"}``（本轮评估）
    4. ``{"type":"done","session_id","reply","module_trace","student_update"}``（结束 + 完整落库数据）

    与 ``run_orchestrator`` 不同，本函数不返回一次性结果，而是边生成边 yield，
    供 SSE 路由逐字推送给前端，获得打字机式实时体验。
    """
    sid = session_id or str(uuid.uuid4())
    initial: State = {
        "student_id": student_id,
        "session_id": sid,
        "message": message,
        "reply": "",
        "module_trace": [],
        "student_ctx": {},
        "intent": "",
        "last_result": {},
        "twin": dict(twin or {}),
        "student_update": {},
    }
    # 同步：意图分类 -> 模块分发（与退化链一致）
    s = _classify(initial)
    s = _dispatch(s)
    trace = s.get("module_trace", [])
    lang = (settings.coach_language or "zh").lower()
    yield {
        "type": "meta",
        "session_id": sid,
        "module_trace": trace,
        "intent": s.get("intent"),
    }

    parts: list[str] = []
    if is_mock():
        # 离线教练一次性产文本，按块模拟流式（含轻微延迟以观感真实）
        full = offline_tutor(s["message"], lang)
        for chunk in _chunk_text(full):
            await asyncio.sleep(0.012)
            parts.append(chunk)
            yield {"type": "delta", "text": chunk}
    else:
        prompt, system, _ = _build_assemble_prompt(s)
        async for delta in chat_completion_stream(prompt, system=system):
            parts.append(delta)
            yield {"type": "delta", "text": delta}

    reply = "".join(parts)
    student_update = await compute_assessment(s["message"], s.get("twin") or {}, reply, lang)
    yield {"type": "assessment", "student_update": student_update}
    yield {
        "type": "done",
        "session_id": sid,
        "reply": reply,
        "module_trace": trace,
        "student_update": student_update,
    }
