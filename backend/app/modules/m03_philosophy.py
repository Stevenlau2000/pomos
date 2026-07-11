"""POMOS 规范模块 03_Teaching_Philosophy（Persona 层）。

定义教学哲学：苏格拉底式提问、脚手架、元认知。此处为 stub。
"""
from app.modules.base import ModuleBase


class PhilosophyModule(ModuleBase):
    name = "m03_philosophy"
    layer = "Persona"
    spec = "03_Teaching_Philosophy"

    def run(self, ctx: dict) -> dict:
        return {
            "module": self.name,
            "action": "apply_philosophy",
            "output": {
                "style": "苏格拉底式提问 + 渐进提示",
                "scaffolding": True,
            },
            "next": "m04_student_model",
        }
