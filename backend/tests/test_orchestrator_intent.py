"""意图路由回归测试。

覆盖 ``app.orchestrator._classify_intent`` 在 ``_KEYWORD_INTENT`` 重排后的行为：

- 「教练 / 辅导 + 题」类请求应命中 ``coaching``（走 m10_AOCS），
  因为 ``辅导`` / ``教练`` 关键词已被移动到 ``题目`` / ``奥赛`` / ``题`` 之前
  （first-match-wins）。
- 纯题请求不应被前置关键词误伤，仍命中 ``problem``（走 m09）。
- 其它意图（如 ``strategy``）不应被误伤。

本测试直接调用纯函数 ``_classify_intent``，不依赖任何 LLM 密钥，
可在离线 mock 模式下稳定全绿。
"""
import pytest

from app.orchestrator import _classify_intent


class TestClassifyIntentRouting:
    """验证重排后意图分类的 first-match-wins 路由。"""

    @pytest.mark.parametrize(
        "message, expected",
        [
            ("教练帮我做这道电磁感应题", "coaching"),
            ("教练，这题我会卡在受力分析", "coaching"),
            ("辅导我做一道动量守恒题", "coaching"),
        ],
    )
    def test_coaching_keyword_precedes_problem(self, message, expected):
        """教练/辅导 已前置，即便句中含「题」也应先命中 coaching。"""
        assert _classify_intent(message) == expected

    @pytest.mark.parametrize(
        "message, expected",
        [
            ("这道电磁感应题怎么解", "problem"),
            ("来一道奥赛题练练", "problem"),
            ("题目：弹簧振子周期", "problem"),
        ],
    )
    def test_pure_problem_routing(self, message, expected):
        """不含教练/辅导关键词的纯题请求仍走 problem。"""
        assert _classify_intent(message) == expected

    def test_strategy_intent_unaffected(self):
        """反例：确认重排未误伤 strategy 等其他意图。"""
        assert _classify_intent("用什么策略复习") == "strategy"
