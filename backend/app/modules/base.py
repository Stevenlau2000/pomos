"""模块基类：ModuleBase 抽象类。

所有 16 个 POMOS 模块 stub 都继承此类，统一实现 `run(ctx) -> dict`。
对应 POMOS 规范的「模块即 Agent 单元」设计理念。
"""
from abc import ABC, abstractmethod
from typing import Any, Dict


class ModuleBase(ABC):
    """POMOS 模块统一抽象基类。"""

    #: 模块文件 ID（如 m01_identity）
    name: str = "base"
    #: 所属层（Persona / Cognitive / Knowledge / Teaching / Runtime）
    layer: str = "unknown"
    #: 映射的 POMOS 规范模块名
    spec: str = ""

    @abstractmethod
    def run(self, ctx: Dict[str, Any]) -> Dict[str, Any]:
        """执行模块逻辑。

        Args:
            ctx: 运行时上下文，含 student_id / session_id / message / memory / student_ctx。

        Returns:
            结构化 dict，形如
            ``{"module": <id>, "action": ..., "output": {...}, "next": ...}``。
        """
        raise NotImplementedError
