"""POMOS 规范模块 13_Cognitive_Memory_Operating_System（Runtime 层）。

CMOS：认知记忆操作系统——六层记忆的读写、巩固与检索。此处为 stub，
实际存储由 app.memory 提供。
"""
from app.modules.base import ModuleBase
from app.memory import get_memory


class MemoryOSModule(ModuleBase):
    name = "m13_memory_os"
    layer = "Runtime"
    spec = "13_Cognitive_Memory_Operating_System"

    def run(self, ctx: dict) -> dict:
        mem = get_memory(ctx.get("student_id"))
        mem.write("episodic", f"msg:{ctx.get('session_id')}", ctx.get("message"))
        return {
            "module": self.name,
            "action": "consolidate",
            "output": {
                "layers": list(mem.store.keys()),
                "written": "episodic",
            },
            "next": "m14_competency_assessment",
        }
