"""
学习数据看板：聚合学习时长、错题、知识点分布、复习参与度、练习正确率等，供仪表盘图表使用。
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DATA_ROOT = Path(r"E:\LearningWeb\data")
GENERATED_DIR = DATA_ROOT / "generated"
PRACTICE_DIR = GENERATED_DIR / "practice_sessions"
HISTORY_FILE = DATA_ROOT / "study_history.json"

log = logging.getLogger("learningweb.tasks.dashboard")


def _parse_ts(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        t = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return t
    except Exception:
        return None


class DashboardService:
    def overview(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        day0 = now.date()
        days_labels: list[str] = []
        for i in range(6, -1, -1):
            d = day0 - timedelta(days=i)
            days_labels.append(d.isoformat())

        daily_minutes: dict[str, float] = {d: 0.0 for d in days_labels}
        week_start = now - timedelta(days=7)

        events: list[dict[str, Any]] = []
        if HISTORY_FILE.is_file():
            try:
                doc = json.loads(HISTORY_FILE.read_text(encoding="utf-8-sig"))
                events = list(doc.get("events", []))
            except Exception as e:
                log.debug("history: %s", e)

        views_week = 0
        chats_week = 0
        for e in events:
            ts = _parse_ts(str(e.get("timestamp", "")))
            if ts is None or ts < week_start:
                continue
            day = ts.date().isoformat()
            action = str(e.get("action", ""))
            if action == "session":
                m = e.get("meta") or {}
                sec = float(m.get("duration_sec", 0) or 0)
                if day in daily_minutes:
                    daily_minutes[day] += sec / 60.0
            elif action == "view":
                views_week += 1
            elif action == "chat":
                chats_week += 1

        weekly_study_minutes = round(sum(daily_minutes.values()), 1)

        # 知识点分布（Top 8）
        from .knowledge_stats_service import KnowledgeStatsService

        ks = KnowledgeStatsService().aggregate()
        points = list(ks.get("points") or [])
        total_wrong = sum(int(p.get("wrong_count", 0) or 0) for p in points)
        top8 = sorted(points, key=lambda x: -int(x.get("wrong_count", 0) or 0))[:8]
        knowledge_bar = [
            {"name": str(p.get("name", "")), "count": int(p.get("wrong_count", 0) or 0)}
            for p in top8
        ]
        pie_data = []
        if total_wrong > 0:
            for p in top8[:6]:
                c = int(p.get("wrong_count", 0) or 0)
                if c > 0:
                    pie_data.append(
                        {
                            "name": str(p.get("name", ""))[:12],
                            "value": c,
                            "full": str(p.get("name", "")),
                        }
                    )
            other = total_wrong - sum(x["value"] for x in pie_data)
            if other > 0:
                pie_data.append({"name": "其他", "value": other, "full": "其他"})

        # 练习正确率：最近一次批改的 score 平均
        scores: list[int] = []
        if PRACTICE_DIR.is_dir():
            for fp in PRACTICE_DIR.glob("*.json"):
                try:
                    data = json.loads(fp.read_text(encoding="utf-8-sig"))
                    ev = data.get("last_evaluation") or {}
                    sc = ev.get("score")
                    if sc is not None and str(sc).isdigit():
                        scores.append(int(sc))
                except Exception:
                    continue
        practice_accuracy_percent = None
        if scores:
            practice_accuracy_percent = round(sum(scores) / len(scores), 1)

        # 复习参与度：推荐维度下的「活跃」代理指标
        from .review_recommend_service import ReviewRecommendService

        rec = ReviewRecommendService().recommend_today(top_n=8)
        n_rec = max(1, len(rec.get("today") or []))
        engagement = min(
            100.0,
            (views_week * 8.0 + chats_week * 12.0) / float(n_rec),
        )
        review_engagement_percent = round(min(100.0, engagement), 1)

        trend = [{"day": k, "minutes": round(daily_minutes[k], 2)} for k in days_labels]

        return {
            "weekly_study_minutes": weekly_study_minutes,
            "daily_study_trend": trend,
            "cumulative_wrong_total": total_wrong,
            "knowledge_bar": knowledge_bar,
            "knowledge_pie": pie_data,
            "review_engagement_percent": review_engagement_percent,
            "practice_accuracy_percent": practice_accuracy_percent,
            "practice_samples": len(scores),
            "week_activity": {
                "views": views_week,
                "chats": chats_week,
            },
            "generated_at": now.isoformat(),
        }
