"""POMOS 模块注册表。

导入全部 16 个模块 stub，建立 ID -> 实例 的注册表，供 orchestrator 按意图分发。
"""
from __future__ import annotations

from app.modules.base import ModuleBase
from app.modules.m01_identity import IdentityModule
from app.modules.m02_mission import MissionModule
from app.modules.m03_philosophy import PhilosophyModule
from app.modules.m04_student_model import StudentModelModule
from app.modules.m05_diagnosis import DiagnosisModule
from app.modules.m06_knowledge_graph import KnowledgeGraphModule
from app.modules.m07_physics_thinking import PhysicsThinkingModule
from app.modules.m08_teaching_strategy import TeachingStrategyModule
from app.modules.m09_olympiad_problem import OlympiadProblemModule
from app.modules.m10_olympiad_coaching import OlympiadCoachingModule
from app.modules.m11_scientific_inquiry import ScientificInquiryModule
from app.modules.m12_learning_orchestration import LearningOrchestrationModule
from app.modules.m13_memory_os import MemoryOSModule
from app.modules.m14_competency_assessment import CompetencyAssessmentModule
from app.modules.m15_multimodal import MultimodalModule
from app.modules.m16_runtime_orchestrator import RuntimeOrchestratorModule

# 全部模块实例注册表（ID -> 实例）
REGISTRY: dict[str, ModuleBase] = {
    "m01_identity": IdentityModule(),
    "m02_mission": MissionModule(),
    "m03_philosophy": PhilosophyModule(),
    "m04_student_model": StudentModelModule(),
    "m05_diagnosis": DiagnosisModule(),
    "m06_knowledge_graph": KnowledgeGraphModule(),
    "m07_physics_thinking": PhysicsThinkingModule(),
    "m08_teaching_strategy": TeachingStrategyModule(),
    "m09_olympiad_problem": OlympiadProblemModule(),
    "m10_olympiad_coaching": OlympiadCoachingModule(),
    "m11_scientific_inquiry": ScientificInquiryModule(),
    "m12_learning_orchestration": LearningOrchestrationModule(),
    "m13_memory_os": MemoryOSModule(),
    "m14_competency_assessment": CompetencyAssessmentModule(),
    "m15_multimodal": MultimodalModule(),
    "m16_runtime_orchestrator": RuntimeOrchestratorModule(),
}

# 已加载模块数（健康检查使用）
MODULES_LOADED: int = len(REGISTRY)


def get_module(module_id: str) -> ModuleBase | None:
    """按 ID 获取模块实例。"""
    return REGISTRY.get(module_id)


def list_module_ids() -> list[str]:
    """返回全部已注册模块 ID。"""
    return list(REGISTRY.keys())
