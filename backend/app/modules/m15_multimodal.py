"""POMOS 规范模块 15_Unified_Multimodal_Learning_Intelligence_Engine（Runtime 层）。

UMLIE：统一多模态学习智能——解析题目图片、手绘、公式等。

本轮实装**本地规则增强版**（零新依赖、可离线、状态 live）：
- 公式输入：纯规则 LaTeX 校验（括号 ``()[]{}`` 配对 / 命令白名单 / ``\\begin{x}...\\end{x}``
  环境闭合 / 反斜杠后跟已知命令或单字母），输出规范化文本与错误定位。
- 图片输入：基于关键词/文件名/上下文的启发式图类分类（受力分析图 / 电路图 / 光路图 /
  运动学图像 / 波形图 / 数据表格图 / 实验装置图 / 几何示意图 / 其他），并给出该类图
  通常需要的分析角度（hints）。真 OCR 本地做不到，故 ``needs_ocr=True`` 且
  ``external_required=True``，但同时返回本地已识别的图类与结构化描述，比纯降级有用。
- 纯文本：无需多模态处理，``external_required=False``。

全程防御式：空 ctx / None 不抛异常；所有异常 try/except 兜底；缺字段回退默认。
双语：复用 ``app.modules._common`` 的 ``_lang`` / ``pick``，status 文案 / 错误说明 /
分类标签支持中英文。
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.modules.base import ModuleBase
from app.modules._common import _lang, pick

logger = logging.getLogger("pomos.module.m15")

# ----------------- 输入检测标记（中英文） -----------------
_IMAGE_MARKERS = ["图片", "图", "照片", "截图", "image", "photo", "picture", "ocr"]
_FORMULA_MARKERS = ["公式", "手写公式", "latex", "formula", "equation"]

# 公式分支延续的静态链（已本地处理，不再指向 external_multimodal_required）
_NEXT_FORMULA = "m07_physics_thinking"
# 纯文本分支延续的静态链
_NEXT_TEXT = "m01_identity"
# 图片分支：深度 OCR 仍需外部服务
_NEXT_IMAGE_EXTERNAL = "external_multimodal_required"

# ----------------- LaTeX 命令白名单（数学/物理常见） -----------------
_LATEX_COMMANDS = frozenset({
    # 核心结构
    "frac", "dfrac", "tfrac", "cfrac", "sqrt", "sum", "int", "iint", "iiint",
    "oint", "prod", "coprod", "lim", "begin", "end", "left", "right",
    # 运算符 / 向量
    "vec", "dot", "ddot", "times", "cdot", "div", "grad", "nabla", "pm", "mp",
    "leq", "geq", "neq", "approx", "equiv", "propto", "sim", "to",
    "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow",
    "partial", "infty", "angle", "perp", "parallel", "mid", "triangle",
    "circ", "star", "ast", "oplus", "otimes", "cup", "cap", "subset",
    "supset", "in", "notin", "forall", "exists", "langle", "rangle",
    "lbrace", "rbrace", "lbrack", "rbrack", "big", "Big", "bigg", "Bigg",
    "binom",
    # 三角函数 / 函数
    "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
    "log", "ln", "exp", "det", "dim", "mod", "gcd", "min", "max", "sup",
    "inf", "deg", "hbar", "ell", "Re", "Im",
    # 希腊字母
    "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
    "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
    "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
    "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi",
    "Omega",
    # 修饰
    "hat", "tilde", "bar", "overline", "underline", "mathbf", "mathit",
    "mathrm", "mathcal", "mathbb", "boldsymbol", "text", "quad", "qquad",
    "space", "!",
})

# ----------------- 图片分类：双语标签 -----------------
_CATEGORY_LABELS: Dict[str, Tuple[str, str]] = {
    "force": ("受力分析图", "Force analysis diagram"),
    "circuit": ("电路图", "Circuit diagram"),
    "optics": ("光路图", "Optical path diagram"),
    "kinematics": ("运动学图像(xt/vt图)", "Kinematics graph (x-t / v-t)"),
    "wave": ("波形图", "Waveform graph"),
    "table": ("数据表格图", "Data table image"),
    "experiment": ("实验装置图", "Experimental setup diagram"),
    "geometry": ("几何示意图", "Geometric schematic"),
    "unknown": ("未识别图类", "Unrecognized image type"),
}

# 分类关键词（中英混合，按命中数择优）
_CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "force": ["受力", "力分析", "free body", "fbd", "隔离", "重力", "弹力",
              "摩擦力", "支持力", "拉力", "张力", "牛顿", "平衡"],
    "circuit": ["电路", "回路", "电阻", "电源", "电流表", "电压表", "串联",
                "并联", "短路", "节点", "导线", "开关", "电动势", "欧姆"],
    "optics": ["光路", "反射", "折射", "透镜", "平面镜", "全反射", "入射",
               "出射", "光线", "成像", "焦距", "虚像", "实像"],
    "kinematics": ["xt图", "vt图", "st图", "x-t", "v-t", "s-t", "位移时间",
                   "速度时间", "运动图像", "斜率", "坐标轴", "位移-时间"],
    "wave": ["波形", "横波", "纵波", "波长", "振幅", "质点振动", "振动图像",
             "干涉", "衍射", "波速", "波函数"],
    "table": ["表格", "数据表", "读数", "测量", "记录", "实验数据", "坐标图",
              "图表", "数值"],
    "experiment": ["实验装置", "装置图", "仪器", "天平", "量筒", "打点计时器",
                   "滑块", "轨道", "气垫", "弹簧秤", "示波器", "导轨", "摆"],
    "geometry": ["几何", "三角形", "矩形", "圆", "角度", "示意图", "向量",
                 "平行四边形", "图示", "边长", "夹角", "投影"],
}

# 各类图通常需要的分析角度（双语）
_CATEGORY_HINTS: Dict[str, Tuple[List[str], List[str]]] = {
    "force": (
        ["识别研究对象并隔离；逐一标注重力、弹力、摩擦力及外力",
         "建立坐标系，按正交方向列牛顿第二/第三定律方程",
         "注意绳/杆约束的张力与接触面法向关系"],
        ["Identify the object and isolate it; mark gravity, normal, friction and applied forces",
         "Set up a coordinate system and write Newton's 2nd/3rd law along orthogonal axes",
         "Mind tension in ropes/rods and the normal direction of contact surfaces"],
    ),
    "circuit": (
        ["明确串/并联关系，化简等效电阻",
         "用基尔霍夫电流/电压定律(KCL/KVL)列方程",
         "注意电表内阻与理想化处理"],
        ["Determine series/parallel structure and reduce to equivalent resistance",
         "Apply Kirchhoff's current/voltage laws (KCL/KVL) to build equations",
         "Mind the internal resistance of meters and idealization assumptions"],
    ),
    "optics": (
        ["画出光路并标注入射/反射/折射角（注意法线）",
         "用反射/折射定律或透镜公式求解",
         "区分实像/虚像与正立/倒立"],
        ["Draw the ray path and label incident/reflected/refracted angles (watch the normal)",
         "Use reflection/refraction laws or the lens equation",
         "Distinguish real/virtual and upright/inverted images"],
    ),
    "kinematics": (
        ["识别坐标轴含义（x-t 还是 v-t）",
         "斜率/面积对应物理量（速度/位移）",
         "注意拐点与分段运动"],
        ["Identify what the axes mean (x-t vs v-t)",
         "Relate slope/area to physical quantities (velocity/displacement)",
         "Watch inflection points and piecewise motion"],
    ),
    "wave": (
        ["识别波长、振幅、周期/频率",
         "判断横波/纵波与传播方向",
         "用波函数或振动方程描述"],
        ["Identify wavelength, amplitude, period/frequency",
         "Determine transverse/longitudinal and propagation direction",
         "Describe with the wave function or oscillation equation"],
    ),
    "table": (
        ["读取关键数据与单位",
         "判断有效数字与测量精度",
         "选择适当的公式或拟合法处理"],
        ["Read key data and their units",
         "Judge significant figures and measurement precision",
         "Pick an appropriate formula or fitting method"],
    ),
    "experiment": (
        ["识别仪器与测量对象",
         "明确实验原理与待求物理量",
         "注意系统误差与操作要点"],
        ["Identify the instruments and what they measure",
         "Clarify the experimental principle and the target quantity",
         "Mind systematic errors and key operational steps"],
    ),
    "geometry": (
        ["标注已知边长/角度/向量",
         "利用几何关系或三角函数求解",
         "注意对称性与投影"],
        ["Label known lengths/angles/vectors",
         "Use geometric relations or trigonometric functions",
         "Watch symmetry and projections"],
    ),
    "unknown": (
        ["建议提供图题说明文字或图内关键标注，以便更精准分类与辅导"],
        ["Please provide a caption or key annotations in the image for more accurate classification and tutoring"],
    ),
}


# ----------------- 模块级纯函数 -----------------
def _read_braced(s: str, pos: int) -> Tuple[Optional[str], int]:
    """从 ``s[pos]``（应为 ``{``）读取成对大括号内容，返回 (内容, 指向下一个字符的索引)。

    支持嵌套大括号；若未闭合返回 (None, 末尾索引)。
    """
    if pos >= len(s) or s[pos] != "{":
        return None, pos
    depth = 0
    j = pos
    while j < len(s):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[pos + 1:j], j + 1
        j += 1
    return None, j


def _validate_latex(formula: Any, ctx: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """纯规则 LaTeX 校验（零依赖）。

    检查项：
    1. 括号 ``()[]{}`` 配对（忽略转义字符与 ``\\begin/\\end`` 的环境名括号）。
    2. ``\\begin{name}`` 与 ``\\end{name}`` 环境名闭合匹配。
    3. 反斜杠后跟已知白名单命令或单字母（否则视为未知命令）。

    返回 ``{"valid": bool, "errors": list[str], "normalized": str, "suggestions": list[str]}``。
    ``normalized`` 去除首尾与多余空白。
    """
    raw = formula if isinstance(formula, str) else str(formula or "")
    errors: List[str] = []
    suggestions: List[str] = []

    # 规范化：折叠连续空白、去首尾空白
    normalized = re.sub(r"\s+", " ", raw).strip()

    if not normalized:
        errors.append(pick("公式内容为空，无法校验", "Formula is empty; nothing to validate.", ctx))
        suggestions.append(pick("请提供非空的 LaTeX 公式", "Please provide a non-empty LaTeX formula.", ctx))
        return {"valid": False, "errors": errors, "normalized": "", "suggestions": suggestions}

    s = normalized
    n = len(s)
    bracket_stack: List[str] = []
    env_stack: List[str] = []
    pair_close = {")": "(", "]": "[", "}": "{"}
    i = 0
    while i < n:
        c = s[i]
        if c == "\\":
            # 命令词：反斜杠后跟字母（可含 *）
            j = i + 1
            while j < n and (s[j].isalpha() or s[j] == "*"):
                j += 1
            if j == i + 1:
                # 反斜杠后非字母：行尾残留（错误）或单符号转义（如 \{ \} \\ \,，合法）
                if j >= n:
                    errors.append(pick(
                        "发现孤立的反斜杠（行尾 \\ 无后续字符）",
                        "Stray backslash at end of input (no character follows '\\').",
                        ctx,
                    ))
                i = j + 1
                continue
            cmd = s[i + 1:j]
            if cmd == "begin":
                name, j2 = _read_braced(s, j)
                if name is None:
                    errors.append(pick(
                        "\\begin 后缺少环境名（应为 \\begin{环境名}）",
                        "\\begin is missing its environment name (expected \\begin{name}).",
                        ctx,
                    ))
                else:
                    env_stack.append(name)
                    j = j2
            elif cmd == "end":
                name, j2 = _read_braced(s, j)
                if name is None:
                    errors.append(pick(
                        "\\end 后缺少环境名（应为 \\end{环境名}）",
                        "\\end is missing its environment name (expected \\end{name}).",
                        ctx,
                    ))
                else:
                    if not env_stack or env_stack[-1] != name:
                        expected = env_stack[-1] if env_stack else ""
                        errors.append(pick(
                            f"\\end{{{name}}} 与最近的 \\begin 不匹配（期望 \\end{{{expected}}}）",
                            f"\\end{{{name}}} does not match the most recent \\begin (expected \\end{{{expected}}}).",
                            ctx,
                        ))
                    else:
                        env_stack.pop()
                    j = j2
            else:
                # 单字母命令（如 \x）或白名单命令合法；其余视为未知命令
                if len(cmd) != 1 and cmd not in _LATEX_COMMANDS:
                    errors.append(pick(
                        f"未识别的 LaTeX 命令 \\{cmd}（不在白名单中）",
                        f"Unrecognized LaTeX command \\{cmd} (not in the allowlist).",
                        ctx,
                    ))
                    suggestions.append(pick(
                        f"若 \\{cmd} 为合法命令，请确认拼写；否则替换为白名单内命令。",
                        f"If \\{cmd} is valid, check the spelling; otherwise replace it with an allowlisted command.",
                        ctx,
                    ))
            i = j
            continue
        if c in ("(", "[", "{"):
            bracket_stack.append(c)
        elif c in (")", "]", "}"):
            if not bracket_stack or bracket_stack[-1] != pair_close[c]:
                errors.append(pick(
                    f"括号不匹配：多余的 '{c}' 或括号类型不配对",
                    f"Bracket mismatch: stray '{c}' or mismatched bracket type.",
                    ctx,
                ))
            else:
                bracket_stack.pop()
        i += 1

    if bracket_stack:
        unclosed = "".join(bracket_stack)
        errors.append(pick(
            f"存在未闭合的括号：{unclosed}",
            f"Unclosed bracket(s) found: {unclosed}",
            ctx,
        ))
    if env_stack:
        errors.append(pick(
            f"存在未闭合的环境：{', '.join(env_stack)}",
            f"Unclosed environment(s): {', '.join(env_stack)}",
            ctx,
        ))

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "normalized": normalized,
        "suggestions": suggestions,
    }


def _image_hints(key: str, ctx: Optional[Dict[str, Any]]) -> List[str]:
    """返回某图类的双语 hints（按 ctx 语言选 zh/en）。"""
    zh_list, en_list = _CATEGORY_HINTS.get(key, _CATEGORY_HINTS["unknown"])
    return en_list if _lang(ctx) == "en" else zh_list


def _classify_image(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """图片启发式分类（零依赖）。

    基于 message + image_meta（filename/name/alt/caption）的关键词命中数择优。
    真 OCR 本地做不到：``needs_ocr=True``；完全无法分类时回退到 ``未识别图类``。
    返回 ``{"category", "confidence", "hints", "needs_ocr"}``。
    """
    message = str(ctx.get("message") or "")
    image_meta = ctx.get("image_meta")
    if not isinstance(image_meta, dict):
        image_meta = {}
    fname = str(image_meta.get("filename") or image_meta.get("name") or "")
    alt = str(image_meta.get("alt") or image_meta.get("caption") or "")
    text = (message + " " + fname + " " + alt).lower()

    best_key: Optional[str] = None
    best_hits = 0
    for key, kws in _CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in kws if kw.lower() in text)
        if hits > best_hits:
            best_hits = hits
            best_key = key

    if best_key is None or best_hits == 0:
        return {
            "category": pick(_CATEGORY_LABELS["unknown"][0], _CATEGORY_LABELS["unknown"][1], ctx),
            "confidence": 0.0,
            "hints": _image_hints("unknown", ctx),
            "needs_ocr": True,
        }

    confidence = round(min(0.95, 0.4 + 0.18 * best_hits), 2)
    return {
        "category": pick(_CATEGORY_LABELS[best_key][0], _CATEGORY_LABELS[best_key][1], ctx),
        "confidence": confidence,
        "hints": _image_hints(best_key, ctx),
        "needs_ocr": True,
    }


def _detect_input_type(ctx: Dict[str, Any]) -> str:
    """按输入类型分派：formula > image > text。

    公式：ctx 含 ``formula`` 或 message 命中 ``_FORMULA_MARKERS``。
    图片：ctx 含 ``image`` / ``image_meta`` 或 message 命中 ``_IMAGE_MARKERS``。
    """
    has_formula = bool(ctx.get("formula"))
    has_image = bool(ctx.get("image")) or isinstance(ctx.get("image_meta"), dict)
    message = str(ctx.get("message") or "").lower()
    if any(m in message for m in _FORMULA_MARKERS):
        has_formula = True
    if any(m in message for m in _IMAGE_MARKERS):
        has_image = True
    if has_formula:
        return "formula"
    if has_image:
        return "image"
    return "text"


class MultimodalModule(ModuleBase):
    name = "m15_multimodal"
    layer = "Runtime"
    spec = "15_Unified_Multimodal_Learning_Intelligence_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：按输入类型分派 → 公式校验 / 图片分类 / 纯文本。

        - 公式：本地 LaTeX 校验，``external_required=False``，next 延续静态链。
        - 图片：本地图类分类 + 结构化描述，``needs_ocr=True`` 且 ``external_required=True``，
          next 指向 ``external_multimodal_required``（深度 OCR 仍需外部服务）。
        - 纯文本：``external_required=False``，next 延续静态链。
        防御式：空 ctx / None 不抛异常；所有异常 try/except 兜底回退纯文本。
        """
        try:
            if not isinstance(ctx, dict):
                ctx = {}
            lang = _lang(ctx)
            input_type = _detect_input_type(ctx)

            if input_type == "formula":
                formula = ctx.get("formula")
                if not isinstance(formula, str):
                    formula = str(ctx.get("message") or "")
                validation = _validate_latex(formula, ctx)
                output = {
                    "modalities": ["formula", "text"],
                    "external_required": False,
                    "reason": pick(
                        "已本地完成公式 LaTeX 校验，无需外部服务",
                        "Formula LaTeX validated locally; no external service required.",
                        ctx,
                    ),
                    "latex_validation": validation,
                    "note": pick(
                        "公式类输入：本地规则引擎完成 LaTeX 校验（括号配对 / 命令白名单 / 环境闭合）。",
                        "Formula input: local rule engine completed LaTeX validation "
                        "(bracket pairing / command allowlist / environment closure).",
                        ctx,
                    ),
                }
                action = "validate_formula"
                nxt = _NEXT_FORMULA

            elif input_type == "image":
                classification = _classify_image(ctx)
                output = {
                    "modalities": ["image", "text"],
                    "external_required": True,
                    "reason": pick(
                        "已本地识别图类并给出结构化描述；深度文字/符号 OCR 仍需外部服务",
                        "Image type identified locally with structured description; "
                        "deep OCR of text/symbols still needs an external service.",
                        ctx,
                    ),
                    "image_classification": classification,
                    "note": pick(
                        "图片类输入：本地规则完成图类分类与处理建议；真 OCR 需外部多模态服务。",
                        "Image input: local rules classified the image type and gave handling "
                        "suggestions; true OCR requires an external multimodal service.",
                        ctx,
                    ),
                }
                action = "classify_image"
                nxt = _NEXT_IMAGE_EXTERNAL

            else:
                output = {
                    "modalities": ["text"],
                    "external_required": False,
                    "reason": pick(
                        "纯文本输入，无需多模态处理",
                        "Plain text input; no multimodal processing required.",
                        ctx,
                    ),
                    "note": pick(
                        "纯文本输入，无需多模态处理",
                        "Plain text input; no multimodal processing required.",
                        ctx,
                    ),
                }
                action = "parse_modality"
                nxt = _NEXT_TEXT

            logger.info(
                "m15 multimodal: type=%s external_required=%s next=%s",
                input_type, output["external_required"], nxt,
            )
            return {
                "module": self.name,
                "action": action,
                "output": output,
                "next": nxt,
            }
        except Exception as exc:  # 极端兜底：绝不抛异常
            logger.warning("m15 run degraded: %s", exc)
            return {
                "module": self.name,
                "action": "parse_modality",
                "output": {
                    "modalities": ["text"],
                    "external_required": False,
                    "reason": pick(
                        "纯文本输入，无需多模态处理",
                        "Plain text input; no multimodal processing required.",
                        ctx,
                    ),
                    "note": pick(
                        "处理异常，已安全回退为纯文本",
                        "Processing error; safely degraded to plain text.",
                        ctx,
                    ),
                },
                "next": _NEXT_TEXT,
            }
