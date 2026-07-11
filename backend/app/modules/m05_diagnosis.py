"""POMOS 规范模块 05_Cognitive_Diagnosis_Engine（Cognitive 层）。

PCDF 八层认知诊断：定位学生卡点所属层级与错误概念。
此处接入真实诊断：基于学生消息检测经典错误概念，并推断 PCDF 层。
（注意：不在此输出 pq —— 统一由 orchestrator 的 _assess 节点产出，
避免与自适应闭环的 student_update 重复/冲突。）
"""
from app.config import settings
from app.modules.assessment_engine import detect_misconceptions
from app.modules.base import ModuleBase


class DiagnosisModule(ModuleBase):
    name = "m05_diagnosis"
    layer = "Cognitive"
    spec = "05_Cognitive_Diagnosis_Engine"

    def run(self, ctx: dict) -> dict:
        msg = ctx.get("message", "") or ""
        lang = (settings.coach_language or "zh").lower()
        miscon = detect_misconceptions(msg, lang)

        if miscon:
            # 出现错误概念，落入「概念表征 / 策略选择」低层
            pcdf_layer = "L2_概念表征"
            confidence = 0.78
            note = miscon[0]["note"]
        elif any(k in msg for k in ("为什么", "因为", "推导", "如何", "怎么")):
            pcdf_layer = "L4_策略执行"
            confidence = 0.62
            note = None
        else:
            pcdf_layer = "L3_表征转化"
            confidence = 0.55
            note = None

        return {
            "module": self.name,
            "action": "diagnose",
            "output": {
                "pcdf_layer": pcdf_layer,
                "misconception": note,
                "confidence": confidence,
            },
            "next": "m06_knowledge_graph",
        }
