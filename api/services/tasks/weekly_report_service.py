"""
学习周报：汇总仪表盘 + 统计 + 学习记录，由 LLM 生成中文周报（可失败降级为模板文本）。
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from services.llm.base import ChatMessage, ChatRequest
from services.llm.router import get_llm

from .dashboard_service import DashboardService
from .knowledge_stats_service import KnowledgeStatsService
from .study_history_service import StudyHistoryService

log = logging.getLogger("learningweb.tasks.weekly_report")


def _fallback_report(dash: dict[str, Any], ks: dict[str, Any], sh: dict[str, Any]) -> str:
    weak = ", ".join(
        str(x.get("name", ""))
        for x in (ks.get("weak_top5") or [])[:5]
        if x.get("name")
    )
    return (
        f"【本周学习概览】\n"
        f"- 本周累计学习时长约 {dash.get('weekly_study_minutes', 0)} 分钟（按 session 上报汇总）。\n"
        f"- 全库错题条目合计约 {dash.get('cumulative_wrong_total', 0)} 道。\n"
        f"- 练习批改样本 {dash.get('practice_samples', 0)} 条，"
        f"平均得分约 {dash.get('practice_accuracy_percent', '—')} 分。\n"
        f"- 复习参与度指数约 {dash.get('review_engagement_percent', 0)}%。\n\n"
        f"【薄弱知识点】{weak or '暂无'}\n\n"
        f"【建议】保持每日固定学习时段，优先复习错题较多的模块；可结合右侧 AI 做针对性提问。\n\n"
        f"【下周计划】完成 2～3 次错题再练；对薄弱点各做 1 套拓展题；上传新材料及时整理。\n"
    )


class WeeklyReportService:
    async def generate(self) -> dict[str, Any]:
        dash = DashboardService().overview()
        ks = KnowledgeStatsService().aggregate()
        sh = StudyHistoryService().summary()

        payload = {
            "dashboard": dash,
            "knowledge_stats": {
                "weak_top5": ks.get("weak_top5"),
                "points_count": len(ks.get("points") or []),
            },
            "study_summary": {
                "total_study_seconds": sh.get("total_study_seconds"),
                "chat_count": sh.get("chat_count"),
                "top_revisited": (sh.get("top_revisited_items") or [])[:5],
            },
        }
        blob = json.dumps(payload, ensure_ascii=False, indent=2)

        text: str
        try:
            llm = get_llm()
            prompt = (
                "你是学习教练。根据下方 JSON 数据，为学习者写一份精简的「一周学习周报」。\n"
                "必须包含小标题：本周总结、薄弱知识点、复习建议、下周计划。\n"
                "语气积极、具体、可执行；总字数 400～700 字。不要用 markdown 代码块。\n\n"
                f"{blob}"
            )
            resp = await llm.chat(
                ChatRequest(
                    messages=[
                        ChatMessage(
                            role="system",
                            content="你只输出中文周报正文，可适度使用换行与小标题。",
                        ),
                        ChatMessage(role="user", content=prompt),
                    ],
                    temperature=0.35,
                    max_tokens=int(os.environ.get("WEEKLY_REPORT_MAX_TOKENS", "1800")),
                )
            )
            text = (resp.content or "").strip() or _fallback_report(dash, ks, sh)
        except Exception as e:
            log.warning("LLM 周报失败，使用模板: %s", e)
            text = _fallback_report(dash, ks, sh)

        return {
            "report": text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "weekly_study_minutes": dash.get("weekly_study_minutes"),
                "cumulative_wrong_total": dash.get("cumulative_wrong_total"),
            },
        }
