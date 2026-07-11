"""CMOS 六层记忆存储 stub。

对应 POMOS 规范模块 13_Cognitive_Memory_Operating_System（CMOS）。
此处仅提供接口与进程内字典实现；生产环境可替换为 Redis / 向量库 / 持久化存储。
"""
from typing import Any, Optional


# CMOS 六层：感知层 / 工作记忆 / 情景记忆 / 语义记忆 / 程序记忆 / 元认知记忆
CMOS_LAYERS: list[str] = [
    "sensory",
    "working",
    "episodic",
    "semantic",
    "procedural",
    "metacognitive",
]


class CMOSMemory:
    """六层记忆存储的简单实现（内存字典）。"""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {layer: {} for layer in CMOS_LAYERS}

    def write(self, layer: str, key: str, value: Any) -> None:
        """向指定记忆层写入一条键值。"""
        if layer not in self.store:
            raise KeyError(f"未知记忆层: {layer}，应为 {CMOS_LAYERS}")
        self.store[layer][key] = value

    def read(self, layer: str, key: str) -> Any:
        """读取指定记忆层的某条键值，不存在返回 None。"""
        return self.store.get(layer, {}).get(key)

    def append(self, layer: str, item: Any) -> None:
        """向指定记忆层追加一条记录（用于工作/情景等列表型记忆层）。"""
        if layer not in self.store:
            raise KeyError(f"未知记忆层: {layer}，应为 {CMOS_LAYERS}")
        bucket = self.store[layer]
        if not isinstance(bucket, list):
            bucket = [bucket] if bucket else []
            self.store[layer] = bucket
        bucket.append(item)

    def snapshot(self) -> dict[str, Any]:
        """返回六层记忆的当前快照（深拷贝，避免外部篡改）。

        列表型层（如工作记忆）直接返回副本，字典型层返回深拷贝。
        """
        out: dict[str, Any] = {}
        for layer, items in self.store.items():
            out[layer] = list(items) if isinstance(items, list) else dict(items)
        return out

    def clear(self) -> None:
        """清空全部记忆层。"""
        self.store = {layer: {} for layer in CMOS_LAYERS}


# ----------------------------------------------------------------- 多租户分片
# 按 student_id 隔离记忆体，消除「全局单例」导致的跨学生记忆污染。
# 生产环境可将此 dict 替换为 Redis / 向量库（以 student_id 为 key）。
_memories: dict[str, CMOSMemory] = {}
# 每个学生的工作记忆最多保留的轮次（防止进程内存只增不减）
MAX_MEM_TURNS = 200


def get_memory(student_id: Optional[str] = None) -> CMOSMemory:
    """获取某学生的 CMOS 记忆体；不传 student_id 时返回默认（_global）分片。

    多学生场景下务必传入 student_id，否则会落到共享分片造成污染。
    """
    key = student_id or "_global"
    return _memories.setdefault(key, CMOSMemory())


def reset_memory(student_id: str) -> None:
    """清空某学生的记忆体（切换/删除学生时调用）。"""
    _memories.pop(student_id, None)


def remember_turn(student_id: str, role: str, content: str) -> None:
    """将一轮对话写入该学生的「工作记忆」层，并裁剪到最近 MAX_MEM_TURNS 条。

    这样记忆体不再是「永远为空」，且严格按学生隔离——不同学生的对话历史
    不会相互污染对方的记忆快照。
    """
    mem = get_memory(student_id)
    mem.append("working", {"role": role, "content": content})
    items = mem.store.get("working")
    if isinstance(items, list) and len(items) > MAX_MEM_TURNS:
        mem.store["working"] = items[-MAX_MEM_TURNS:]
