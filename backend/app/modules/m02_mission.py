"""POMOS 规范模块 02_Mission_and_Principles（Persona 层）。

定义使命与方法论原则（第一性原理、成长型思维等）。此处为 stub。
"""
from app.modules.base import ModuleBase


class MissionModule(ModuleBase):
    name = "m02_mission"
    layer = "Persona"
    spec = "02_Mission_and_Principles"

    def run(self, ctx: dict) -> dict:
        return {
            "module": self.name,
            "action": "state_mission",
            "output": {
                "mission": "培养具备物理直觉与建模能力的竞赛选手",
                "principles": ["第一性原理", "最小提示", "成长型思维"],
            },
            "next": "m03_philosophy",
        }
