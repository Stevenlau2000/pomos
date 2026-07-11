"""POMOS 评估引擎（14_HPCAS / 05_Cognitive_Diagnosis 的实质性实现）。

职责：每次对话后，基于「学生消息 + 当前九维画像 + 导师回复」产出：
- ``pq``：物理素养综合分（Physics Quotient，0~1），由九维加权得到；
- ``mastery_delta``：本次对话带来的九维掌握度微调（可正可负）；
- ``weak_concepts``：检测到的错误概念（misconception）；
- ``recommendations``：针对性训练建议。

两种模式：
- 离线（mock，未配任何 LLM 密钥）：``heuristic_assess`` 用确定性启发式，
  保证零密钥也能给出有意义的、随对话演进的能力评估；
- 在线（已配密钥）：``llm_assess`` 让 LLM 以 HPCAS 评估员身份返回结构化 JSON。

对应 POMOS 规范的「让自适应闭环从通变成有用」——评估必须反映学生真实表现。
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from app.config import settings
from app.llm import chat_completion, is_mock

# 九维 Student Twin 维度键（与 models.NINE_DIMS 一致）
NINE_DIMS: List[str] = [
    "concept", "modeling", "reasoning", "calculation",
    "experiment", "transfer", "meta", "competition", "growth",
]

# PQ 九维权重（总和为 1.0）
PQ_WEIGHTS: Dict[str, float] = {
    "concept": 0.15,
    "modeling": 0.18,
    "reasoning": 0.18,
    "calculation": 0.12,
    "experiment": 0.10,
    "transfer": 0.12,
    "meta": 0.05,
    "competition": 0.06,
    "growth": 0.04,
}

# 各维度信号关键词（命中越多，该维掌握度正向微调越大）
DIM_KEYWORDS: Dict[str, List[str]] = {
    "concept": ["概念", "定义", "是什么", "含义", "物理意义", "本质", "微观", "宏观", "理解"],
    "modeling": ["建模", "模型", "假设", "近似", "方程", "推导", "建立", "边界条件", "坐标系", "设"],
    "reasoning": ["为什么", "因为", "所以", "因此", "逻辑", "论证", "判断", "推理", "因果"],
    "calculation": ["计算", "积分", "求导", "数值", "代入", "算", "解", "矩阵", "运算"],
    "experiment": ["实验", "测量", "数据", "误差", "仪器", "观测", "探究", "装置"],
    "transfer": ["类比", "类似", "推广", "迁移", "另一", "不同情境", "应用", "举一反三"],
    "meta": ["我错了", "我理解", "我没想到", "反思", "我学会", "我明白", "我以为", "弱点", "不足"],
    "competition": ["竞赛", "奥赛", "ipho", "cpho", "复赛", "决赛", "省队", "国家队", "压轴", "难题"],
    "growth": ["下一步", "继续", "进一步", "请教", "练习", "巩固", "复习", "再"],
}

# 高级物理词汇（命中提升 concept/modeling 信号，并作为整体投入度证据）
ADVANCED_VOCAB: List[str] = [
    "微扰", "哈密顿", "拉格朗日", "张量", "对称", "傅里叶", "洛伦兹", "熵", "相空间",
    "本征", "波动方程", "麦克斯韦", "量子", "相对论", "谐振子", "矢量", "边界条件",
    "守恒", "角动量", "转动惯量", "简谐", "基尔霍夫", "电动势", "电场", "磁场", "磁通",
    "势能", "动能", "非线性", "混沌", "相变", "波函数", "算符", "狄拉克", "泊松",
    "拉普拉斯", "梯度", "散度", "旋度", "积分方程", "格林函数", "态密度", "自由度",
]

# 经典错误概念库：触发短语 -> 影响维度 + 中英文说明
MISCONCEPTIONS: List[Dict[str, Any]] = [
    {"keys": ["力是维持", "力维持运动", "力是使物体运动的原因"], "dims": ["reasoning", "concept"],
     "zh": "误以为「力是维持物体运动的原因」（亚里士多德式错误），实际力改变运动状态",
     "en": "Believes force sustains motion (Aristotelian error); force changes motion"},
    {"keys": ["匀速圆周运动受力平衡", "圆周运动合力为零"], "dims": ["reasoning"],
     "zh": "误以为匀速圆周运动受力平衡，实际存在指向圆心的向心力",
     "en": "Thinks uniform circular motion is force-balanced; centripetal force exists"},
    {"keys": ["质量越大惯性越小", "速度越大惯性越大"], "dims": ["concept"],
     "zh": "误判惯性与质量/速度的关系，惯性只由质量决定",
     "en": "Misjudges inertia vs mass/speed; inertia depends only on mass"},
    {"keys": ["机械能守恒无条件", "机械能总是守恒"], "dims": ["concept", "reasoning"],
     "zh": "误以为机械能无条件守恒，仅在只有重力/弹力做功时守恒",
     "en": "Thinks mechanical energy is always conserved; only with conservative forces"},
    {"keys": ["电场线就是轨迹", "电场线是电荷运动轨迹"], "dims": ["concept"],
     "zh": "误把电场线当作电荷运动轨迹，轨迹由初速度与受力共同决定",
     "en": "Confuses field lines with charge trajectory; trajectory needs initial velocity"},
    {"keys": ["电阻与电压成正比", "电阻随电压增大"], "dims": ["concept"],
     "zh": "误以为电阻随电压增大，电阻是导体本身属性（除非考虑温度）",
     "en": "Thinks resistance grows with voltage; it is an intrinsic property"},
    {"keys": ["温度升高内能一定升高", "温度不变内能不变"], "dims": ["concept"],
     "zh": "忽略相变等过程中温度与内能的非单调关系",
     "en": "Ignores non-monotonic T↔internal-energy (e.g. phase change)"},
    {"keys": ["动量守恒只在碰撞", "只有碰撞才动量守恒"], "dims": ["concept", "reasoning"],
     "zh": "误以为动量守恒只发生在碰撞中，系统合外力为零即守恒",
     "en": "Thinks momentum conserves only in collisions; valid when net external force is zero"},
    {"keys": ["浮力总是等于重力", "浮力等于重力"], "dims": ["reasoning"],
     "zh": "误以为浮力总等于重力，漂浮/悬浮时才相等",
     "en": "Thinks buoyancy always equals weight; only for floating/suspended"},
    {"keys": ["非惯性系不用惯性力", "惯性系才需要惯性力"], "dims": ["reasoning", "concept"],
     "zh": "混淆惯性系与非惯性系，非惯性系需引入惯性力",
     "en": "Confuses frames; fictitious force needed in non-inertial frames"},
]

# 维度训练建议（中英文）
DIM_ADVICE: Dict[str, Dict[str, str]] = {
    "concept": {"zh": "巩固核心概念，用费曼技巧复述定义与物理意义",
                "en": "Consolidate core concepts; re-explain definitions in your own words"},
    "modeling": {"zh": "多做建模题：设变量→列方程→定边界条件 三步走",
                 "en": "Practice modeling: variables → equations → boundary conditions"},
    "reasoning": {"zh": "训练因果推理，先写「因为…所以…」再下结论",
                  "en": "Train causal reasoning; write 'because…therefore…' first"},
    "calculation": {"zh": "规范计算步骤，注意矢量方向与单位换算",
                    "en": "Standardize calculation; watch vector direction and units"},
    "experiment": {"zh": "补齐实验探究，关注误差分析与图像拟合",
                   "en": "Strengthen inquiry; focus on error analysis and curve fitting"},
    "transfer": {"zh": "做跨情境迁移题，类比已学模型",
                 "en": "Do cross-context transfer problems; analogize known models"},
    "meta": {"zh": "建立错题反思习惯，记录「我为什么错」",
             "en": "Build reflection habit; journal 'why I was wrong'"},
    "competition": {"zh": "刷近三年省赛/复赛真题，限时训练",
                    "en": "Drill past provincial/final papers under time pressure"},
    "growth": {"zh": "保持每周固定训练量，跟踪成长曲线",
               "en": "Keep a steady weekly volume; track your growth curve"},
}


def detect_misconceptions(message: str, lang: str = "zh") -> List[Dict[str, Any]]:
    """检测消息中的经典错误概念，返回 [{dims, note}]。"""
    text = (message or "").lower()
    out: List[Dict[str, Any]] = []
    for m in MISCONCEPTIONS:
        for k in m["keys"]:
            if k.lower() in text:
                out.append({
                    "dims": m["dims"],
                    "note": m["en"] if lang == "en" else m["zh"],
                })
                break
    return out


def _build_recommendations(
    updated: Dict[str, float], miscon: List[Dict[str, Any]], lang: str
) -> List[str]:
    """基于最弱维度 + 错误概念生成建议。"""
    recs: List[str] = []
    if miscon:
        first = miscon[0]
        recs.append(first["note"])
    # 取掌握度最低的 2 个维度给针对性建议
    ranked = sorted(NINE_DIMS, key=lambda d: updated.get(d, 0.0))[:2]
    for d in ranked:
        advice = DIM_ADVICE.get(d, {})
        recs.append(advice.get("en" if lang == "en" else "zh", ""))
    # 去空、去重、限 3 条
    seen = set()
    uniq: List[str] = []
    for r in recs:
        if r and r not in seen:
            seen.add(r)
            uniq.append(r)
        if len(uniq) >= 3:
            break
    return uniq


def heuristic_assess(
    message: str, twin: Dict[str, float], reply: str, lang: str = "zh"
) -> Dict[str, Any]:
    """离线确定性评估：由消息信号 + 当前画像推导本次 delta 与 pq。"""
    text = message or ""
    low = text.lower()
    is_question = ("?" in text) or ("？" in text)
    length = len(text)

    # 各维度关键词命中
    hits: Dict[str, int] = {d: 0 for d in NINE_DIMS}
    for dim, kws in DIM_KEYWORDS.items():
        for kw in kws:
            if kw.lower() in low:
                hits[dim] += 1

    vocab_hits = sum(1 for v in ADVANCED_VOCAB if v.lower() in low)
    miscon = detect_misconceptions(text, lang)

    delta: Dict[str, float] = {}
    for dim in NINE_DIMS:
        h = hits[dim]
        if h > 0:
            delta[dim] = round(min(0.04, 0.006 + 0.004 * h), 3)
    # 高级词汇提升概念/建模信号
    if vocab_hits > 0:
        delta["concept"] = round(min(0.05, delta.get("concept", 0.0) + 0.004 * vocab_hits), 3)
        delta["modeling"] = round(min(0.05, delta.get("modeling", 0.0) + 0.003 * vocab_hits), 3)
    # 提问/长消息体现投入度，给通用小正反馈（新学生也能从 0 起步成长）
    if not delta and (is_question or length > 6):
        for d in ("concept", "reasoning", "growth"):
            delta[d] = 0.01
    # 错误概念惩罚对应维度
    for m in miscon:
        for d in m["dims"]:
            delta[d] = round(delta.get(d, 0.0) - 0.03, 3)
    # 钳制单轮幅度
    for d in list(delta):
        delta[d] = round(max(-0.08, min(0.06, delta[d])), 3)

    # 更新后画像 + PQ
    updated = {
        d: round(min(1.0, max(0.0, twin.get(d, 0.0) + delta.get(d, 0.0))), 3)
        for d in NINE_DIMS
    }
    pq = round(sum(PQ_WEIGHTS[d] * updated[d] for d in NINE_DIMS), 3)
    weak = [m["note"] for m in miscon]
    recs = _build_recommendations(updated, miscon, lang)

    return {
        "pq": pq,
        "mastery_delta": {d: delta[d] for d in delta if delta[d] != 0},
        "weak_concepts": weak,
        "recommendations": recs,
    }


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """从 LLM 返回中稳健提取第一个 JSON 对象。"""
    if not text:
        return None
    s = text.strip()
    # 去掉 ```json ... ``` 包裹
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s)
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(s[start : end + 1])
    except Exception:
        return None


async def llm_assess(
    message: str, twin: Dict[str, float], reply: str, lang: str = "zh"
) -> Dict[str, Any]:
    """在线评估：让 LLM 以 HPCAS 评估员身份返回结构化 JSON。"""
    twin_str = json.dumps(twin, ensure_ascii=False)
    if lang == "en":
        sys = (
            "You are the HPCAS evaluator of POMOS, a physics olympiad (CPhO/IPhO) "
            "competency system. Given the student's message, their current 9-dimension "
            "twin, and the mentor's reply, return STRICT JSON only: "
            '{"pq": <float 0-1>, "mastery_delta": {<dim>: <float -0.08..0.06>}, '
            '"weak_concepts": [<string>], "recommendations": [<string>]}. '
            "Dimensions: concept, modeling, reasoning, calculation, experiment, transfer, "
            "meta, competition, growth."
        )
        prompt = (
            f"Student message: {message}\n"
            f"Current twin: {twin_str}\n"
            f"Mentor reply (for context): {reply[:400]}\n"
            "Assess the student's physics competency shown in THIS turn."
        )
    else:
        sys = (
            "你是 POMOS 的 HPCAS 物理能力评估员。结合学生的消息、其当前九维 Student Twin "
            "画像与导师回复，只返回严格 JSON："
            '{"pq": <0~1 浮点>, "mastery_delta": {<维度>: <浮点 -0.08~0.06>}, '
            '"weak_concepts": [<字符串>], "recommendations": [<字符串>]}。'
            "维度包括：concept, modeling, reasoning, calculation, experiment, transfer, "
            "meta, competition, growth。"
        )
        prompt = (
            f"学生消息：{message}\n"
            f"当前画像：{twin_str}\n"
            f"导师回复（仅作上下文）：{reply[:400]}\n"
            "请评估该学生在本轮对话中展现的物理能力。"
        )
    raw = await chat_completion(prompt, system=sys)
    data = _extract_json(raw)
    if not data:
        raise ValueError("LLM 未返回可解析的 JSON")
    pq = float(data.get("pq", 0.0))
    md = data.get("mastery_delta") or {}
    mastery_delta = {
        d: round(max(-0.08, min(0.06, float(v))), 3)
        for d, v in md.items()
        if d in NINE_DIMS
    }
    weak = [str(x) for x in (data.get("weak_concepts") or [])][:5]
    recs = [str(x) for x in (data.get("recommendations") or [])][:5]
    return {
        "pq": round(max(0.0, min(1.0, pq)), 3),
        "mastery_delta": mastery_delta,
        "weak_concepts": weak,
        "recommendations": recs,
    }


async def compute_assessment(
    message: str, twin: Dict[str, float], reply: str, lang: str = "zh"
) -> Dict[str, Any]:
    """统一评估入口：mock 走启发式，在线走 LLM（失败回退启发式）。"""
    if is_mock():
        return heuristic_assess(message, twin, reply, lang)
    try:
        return await llm_assess(message, twin, reply, lang)
    except Exception:
        return heuristic_assess(message, twin, reply, lang)
