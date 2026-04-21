"""
智能复习推荐：综合知识点错题统计、最近一次错题时间、难度与学习记录。
依赖 knowledge_stats + study_history。
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from .knowledge_stats_service import KnowledgeStatsService
from .study_history_service import StudyHistoryService

log = logging.getLogger("learningweb.tasks.review_recommend")


def _days_since(iso: str | None) -> float:
    if not iso:
        return 30.0
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        return max(0.0, delta.total_seconds() / 86400.0)
    except Exception:
        return 15.0


class ReviewRecommendService:
    def recommend_today(self, *, top_n: int = 8) -> dict[str, Any]:
        ks = KnowledgeStatsService().aggregate()
        sh = StudyHistoryService().summary()
        points = list(ks.get("points") or [])
        if not points:
            return {
                "today": [],
                "scored": [],
                "reason": "暂无错题统计数据，请先整理错题。",
                "generated_at": ks.get("generated_at"),
            }

        # 近期对话多 → 略提高整体复习紧迫度（学习投入代理）
        chat_n = float(sh.get("chat_count", 0) or 0)
        revisit_n = len(sh.get("top_revisited_items") or [])

        scored: list[dict[str, Any]] = []
        for p in points:
            name = str(p.get("name", "未分类"))
            wc = float(p.get("wrong_count", 0) or 0)
            ad = float(p.get("avg_difficulty", 2) or 2)
            last = p.get("last_wrong_at")
            days = _days_since(last if isinstance(last, str) else None)

            # 分数越高越应优先复习：错得多、越久未碰、难度偏高；学习行为微调
            score = (
                wc * 3.0
                + math.log1p(days) * 2.0
                + (ad - 1.0) * 1.5
                + min(2.0, math.log1p(chat_n) * 0.2)
                + min(1.5, revisit_n * 0.05)
            )
            scored.append(
                {
                    "knowledge_point": name,
                    "score": round(score, 3),
                    "wrong_count": int(wc),
                    "avg_difficulty": ad,
                    "last_wrong_at": last,
                    "days_since_wrong": round(days, 2),
                }
            )

        scored.sort(key=lambda x: (-x["score"], x["knowledge_point"]))
        today = [x["knowledge_point"] for x in scored[:top_n]]

        return {
            "today": today,
            "scored": scored[:top_n],
            "weak_top5_from_stats": [x["name"] for x in ks.get("weak_top5") or []],
            "generated_at": ks.get("generated_at"),
        }
