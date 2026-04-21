"""
学习记录：查看题目、对话、重复错题、学习时长等，为学习路径与复习推荐提供数据。
落盘：data/study_history.json

学习时长：由前端或服务定时上报，例如::

    POST /api/study/event
    {"action": "session", "meta": {"duration_sec": 120}}

summary() 会累计 meta.duration_sec。
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

DATA_ROOT = Path(r"E:\LearningWeb\data")
HISTORY_FILE = DATA_ROOT / "study_history.json"

log = logging.getLogger("learningweb.tasks.study_history")

MAX_EVENTS = int(__import__("os").environ.get("STUDY_HISTORY_MAX_EVENTS", "8000"))

ActionType = Literal["view", "chat", "repeat_wrong", "session", "practice_start", "practice_submit"]


class StudyHistoryService:
    def _load(self) -> dict[str, Any]:
        if not HISTORY_FILE.is_file():
            return {"version": 1, "events": []}
        try:
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8-sig"))
        except Exception as e:
            log.warning("study_history 读取失败，使用空集: %s", e)
            return {"version": 1, "events": []}

    def _save(self, doc: dict[str, Any]) -> None:
        DATA_ROOT.mkdir(parents=True, exist_ok=True)
        HISTORY_FILE.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def append_event(
        self,
        *,
        action: str,
        item_id: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        doc = self._load()
        ev: dict[str, Any] = {
            "id": uuid.uuid4().hex,
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if item_id:
            ev["item_id"] = item_id
        if meta:
            ev["meta"] = meta
        events = list(doc.get("events", []))
        events.append(ev)
        if len(events) > MAX_EVENTS:
            events = events[-MAX_EVENTS:]
        doc["events"] = events
        doc["version"] = 1
        self._save(doc)
        return ev

    def list_events(self, *, limit: int = 200) -> list[dict[str, Any]]:
        doc = self._load()
        ev = list(doc.get("events", []))
        return ev[-limit:]

    def summary(self) -> dict[str, Any]:
        """聚合：学习时长、题目浏览、对话次数、重复访问最多的题。"""
        doc = self._load()
        events = list(doc.get("events", []))

        total_study_sec = 0.0
        item_views: dict[str, int] = defaultdict(int)
        chat_count = 0
        practice_submit = 0

        for e in events:
            action = str(e.get("action", ""))
            if action == "chat":
                chat_count += 1
            elif action == "session":
                m = e.get("meta") or {}
                total_study_sec += float(m.get("duration_sec", 0) or 0)
            elif action == "practice_submit":
                practice_submit += 1
            elif action == "view" and e.get("item_id"):
                item_views[str(e["item_id"])] += 1

        # 重复错题：同一 item_id 被 view >=2 次
        repeat_items = [(i, c) for i, c in item_views.items() if c >= 2]
        repeat_items.sort(key=lambda x: (-x[1], x[0]))
        top_revisited = [
            {"item_id": i, "views": c} for i, c in repeat_items[:15]
        ]

        return {
            "total_study_seconds": round(total_study_sec, 1),
            "total_events": len(events),
            "chat_count": chat_count,
            "practice_submit_count": practice_submit,
            "item_view_counts": dict(sorted(item_views.items(), key=lambda kv: (-kv[1], kv[0]))),
            "top_revisited_items": top_revisited,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
