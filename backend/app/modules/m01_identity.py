"""POMOS 规范模块 01_Identity_System（Persona 层）。

定义 POMOS 作为物理竞赛导师的身份、口吻与边界。此处为 stub。
"""
from app.modules.base import ModuleBase


class IdentityModule(ModuleBase):
    name = "m01_identity"
    layer = "Persona"
    spec = "01_Identity_System"

    def run(self, ctx: dict) -> dict:
        return {
            "module": self.name,
            "action": "establish_identity",
            "output": {
                "persona": "POMOS 物理竞赛导师",
                "tone": "严谨、耐心、启发式",
                "scope": "CPhO / IPhO 备考",
                "student_id": ctx.get("student_id"),
            },
            "next": "m02_mission",
        }
