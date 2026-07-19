"""POMOS 规范模块 09_Olympiad_Problem_Intelligence_Engine（Teaching 层）。

OPIE：题目智能——检索/生成/改编符合竞赛难度的题目与解析。
- ``match_difficulty(message, student_ctx)``：从题面/学情推断板块与难度档位。
- ``recommend_problem(board, difficulty, lang)``：从题库匹配最贴近的竞赛题。
- ``adapt_problem(problem, lang, target_difficulty)``：参数扰动改编（考点不变、难度档位匹配）。
题库取自 ``app.data.problem_bank``。纯规则，不接 LLM；双语题目/解析。
设计文档见任务分解 T04。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from app.modules.base import ModuleBase
from app.modules._common import _lang, pick
from app.data.problem_bank import PROBLEM_BANK

logger = logging.getLogger("pomos.module.m09")

# 板块推断关键词（题面 → 板块）；先放具体概念词，再放板块名（兜底匹配）
_BOARD_KEYWORDS: List[Tuple[str, str]] = [
    ("电磁感应", "电磁学"), ("磁场", "电磁学"), ("静电", "电磁学"),
    ("电路", "电磁学"), ("电荷", "电磁学"), ("电势", "电磁学"), ("电磁学", "电磁学"),
    ("牛顿", "力学"), ("刚体", "力学"), ("转动", "力学"),
    ("动量", "力学"), ("振动", "力学"), ("波", "力学"), ("力学", "力学"),
    ("热", "热学"), ("温度", "热学"), ("气体", "热学"), ("熵", "热学"), ("热学", "热学"),
    ("折射", "光学"), ("干涉", "光学"), ("衍射", "光学"), ("光学", "光学"),
    ("量子", "近代物理"), ("相对论", "近代物理"), ("原子", "近代物理"), ("光电", "近代物理"),
    ("近代物理", "近代物理"),
]

# 难度档位推断关键词（题面 → 1~5）
_DIFF_KEYWORDS: List[Tuple[str, int]] = [
    ("入门", 1), ("基础", 1), ("预赛", 2),
    ("进阶", 3), ("复赛", 4), ("决赛", 5), ("压轴", 5), ("省队", 5),
]


def localize_problem(p: Dict[str, Any], lang: str = "zh") -> Dict[str, Any]:
    """把题库原始条目本地化为目标语言的标准题结构。

    返回字段：id / board / difficulty / topic / 考点 / statement / solution / source。
    """
    en = (lang or "zh") == "en"
    return {
        "id": p.get("id"),
        "board": p.get("board"),
        "difficulty": p.get("difficulty"),
        "topic": p.get("topic_en") if en else p.get("topic_zh"),
        "考点": p.get("kpoint_en") if en else p.get("kpoint_zh"),
        "statement": p.get("statement_en") if en else p.get("statement_zh"),
        "solution": p.get("solution_en") if en else p.get("solution_zh"),
        "source": p.get("source"),
    }


def match_difficulty(
    message: str = "",
    student_ctx: Optional[Dict[str, Any]] = None,
) -> Tuple[str, int]:
    """推断板块与难度档位。

    - 板块：题面关键词优先；否则取 student_ctx.board；缺省 "力学"。
    - 难度：题面关键词优先；否则取 student_ctx.difficulty；缺省 3。
    """
    student_ctx = student_ctx or {}
    text = message or ""
    board = None
    for kw, b in _BOARD_KEYWORDS:
        if kw in text:
            board = b
            break
    if board is None:
        board = student_ctx.get("board") or "力学"

    difficulty = None
    for kw, d in _DIFF_KEYWORDS:
        if kw in text:
            difficulty = d
            break
    if difficulty is None:
        try:
            difficulty = int(student_ctx.get("difficulty") or 3)
        except (TypeError, ValueError):
            difficulty = 3
    difficulty = max(1, min(5, difficulty))
    return board, difficulty


def recommend_problem(
    board: str,
    difficulty: int,
    lang: str = "zh",
    n: int = 2,
) -> List[Dict[str, Any]]:
    """从题库推荐最贴近 (board, difficulty) 的竞赛题。

    优先同板块；同板块不足时回退全库。排序：难度差升序 → importance 降序。
    """
    pool = [p for p in PROBLEM_BANK if p.get("board") == board]
    if not pool:
        pool = list(PROBLEM_BANK)
    pool.sort(key=lambda p: (abs(int(p.get("difficulty", 3)) - difficulty), -int(p.get("importance", 3))))
    chosen = pool[: max(1, int(n))]
    return [localize_problem(p, lang) for p in chosen]


def adapt_problem(
    problem: Dict[str, Any],
    lang: str = "zh",
    target_difficulty: Optional[int] = None,
) -> Dict[str, Any]:
    """参数扰动改编：考点不变，难度档位匹配。

    - 保留 考点（kpoint）不变。
    - 若给定 target_difficulty，则把难度调整为其档位（"难度档位已匹配"）。
    - 题面追加参数改编标记（明确考点不变）。
    返回结构与原题一致（id/board/difficulty/topic/考点/statement/solution/source）。
    """
    if not isinstance(problem, dict):
        return problem
    adapted = dict(problem)
    if target_difficulty is not None:
        adapted["difficulty"] = max(1, min(5, int(target_difficulty)))
    note_zh = "（参数改编：难度档位匹配，考点不变）"
    note_en = " (parameter adaptation: difficulty tier matched, key points unchanged)"
    note = note_en if (lang or "zh") == "en" else note_zh
    adapted["statement"] = (adapted.get("statement") or "") + note
    adapted["adapted"] = True
    return adapted


class OlympiadProblemModule(ModuleBase):
    name = "m09_olympiad_problem"
    layer = "Teaching"
    spec = "09_Olympiad_Problem_Intelligence_Engine"

    def run(self, ctx: dict) -> dict:
        """装配函数：取板块/难度 → 推荐题 → 必要时参数改编匹配档位 → 标准返回。

        防御式：缺字段绝不抛异常；回退默认板块/难度。
        """
        if not isinstance(ctx, dict):
            ctx = {}
        lang = _lang(ctx)
        student_ctx = ctx.get("student_ctx") if isinstance(ctx.get("student_ctx"), dict) else {}
        message = ctx.get("message", "") or ""

        board, difficulty = match_difficulty(message, student_ctx)
        problems = recommend_problem(board, difficulty, lang, n=2)

        adapted = False
        match_note = ""
        if problems and int(problems[0].get("difficulty", difficulty)) != difficulty:
            # 推荐题难度与目标档位不一致 → 参数改编以匹配档位（考点不变）
            problems = [adapt_problem(p, lang, target_difficulty=difficulty) for p in problems]
            adapted = True
            match_note = pick(
                f"已按目标难度档位[{difficulty}]改编题目（考点不变）",
                f"Problems adapted to target difficulty tier [{difficulty}] (key points unchanged).",
                ctx,
            )
        else:
            match_note = pick(
                f"已匹配板块[{board}]难度[{difficulty}]的竞赛题",
                f"Matched {board} problems at difficulty {difficulty}.",
                ctx,
            )

        logger.info(
            "m09 problem: board=%s difficulty=%s adapted=%s",
            board, difficulty, adapted,
        )
        return {
            "module": self.name,
            "action": "recommend_problem",
            "output": {
                "problems": problems,
                "adapted": adapted,
                "match_note": match_note,
            },
            "next": "m10_olympiad_coaching",
        }
