"""POMOS 规范模块 08_Teaching_Strategy_Engine（Teaching 层）。

六模式 + 五级 Hint：根据学情选择讲解/追问/类比等模式与提示等级。此处为 stub。
"""
from app.modules.base import ModuleBase


class TeachingStrategyModule(ModuleBase):
    name = "m08_teaching_strategy"
    layer = "Teaching"
    spec = "08_Teaching_Strategy_Engine"

    def run(self, ctx: dict) -> dict:
        return {
            "module": self.name,
            "action": "select_strategy",
            "output": {
                "mode": "引导式追问",
                "hint_level": 2,
            },
            "next": "m09_olympiad_problem",
        }
