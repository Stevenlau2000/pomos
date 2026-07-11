"""POMOS 规范模块 10_Adaptive_Olympiad_Coaching_System（Teaching 层）。

AOCS：自适应教练系统——围绕单题进行多轮引导与即时反馈。此处为 stub。
"""
from app.modules.base import ModuleBase


class OlympiadCoachingModule(ModuleBase):
    name = "m10_olympiad_coaching"
    layer = "Teaching"
    spec = "10_Adaptive_Olympiad_Coaching_System"

    def run(self, ctx: dict) -> dict:
        return {
            "module": self.name,
            "action": "coach",
            "output": {
                "turn": 1,
                "feedback": "先画出受力图，再考虑约束关系",
            },
            "next": "m11_scientific_inquiry",
        }
