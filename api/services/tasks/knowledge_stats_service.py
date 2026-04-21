"""
知识点统计：从 data/generated/wrong_questions_*.json 聚合。
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_ROOT = Path(r"E:\LearningWeb\data")
GENERATED_DIR = DATA_ROOT / "generated"

log = logging.getLogger("learningweb.tasks.knowledge_stats")

DIFF_MAP = {"easy": 1.0, "medium": 2.0, "hard": 3.0}


@dataclass(frozen=True)
class KnowledgePointStats:
    name: str
    wrong_count: int
    avg_difficulty: float  # 1–3 数值均值
    last_wrong_at: str | None  # ISO


class KnowledgeStatsService:
    def aggregate(self) -> dict[str, Any]:
        """
        返回：
        - counts: { "导数": 5, ... }
        - points: [{ name, wrong_count, avg_difficulty, last_wrong_at }, ...]
        - weak_top5: 按错题数量降序前 5
        """
        counts: dict[str, int] = defaultdict(int)
        diff_sum: dict[str, float] = defaultdict(float)
        last_ts: dict[str, float] = {}

        if not GENERATED_DIR.is_dir():
            return self._empty()

        for fp in sorted(GENERATED_DIR.glob("wrong_questions_*.json")):
            try:
                data = json.loads(fp.read_text(encoding="utf-8-sig"))
            except Exception as e:
                log.warning("跳过无效 JSON: %s %s", fp, e)
                continue
            try:
                mtime = fp.stat().st_mtime
            except OSError:
                mtime = 0.0
            for it in data.get("items", []) or []:
                kp = str(it.get("knowledge_point") or "未分类").strip() or "未分类"
                counts[kp] += 1
                d = str(it.get("difficulty") or "medium").lower()
                diff_sum[kp] += DIFF_MAP.get(d, 2.0)
                if kp not in last_ts or mtime > last_ts[kp]:
                    last_ts[kp] = mtime

        points: list[dict[str, Any]] = []
        for name, c in counts.items():
            avg = diff_sum[name] / c if c else 2.0
            iso = None
            if name in last_ts:
                iso = datetime.fromtimestamp(last_ts[name], tz=timezone.utc).isoformat()
            points.append(
                {
                    "name": name,
                    "wrong_count": c,
                    "avg_difficulty": round(avg, 3),
                    "last_wrong_at": iso,
                }
            )

        points.sort(key=lambda x: (-x["wrong_count"], x["name"]))
        weak_top5 = points[:5]

        return {
            "counts": dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))),
            "points": points,
            "weak_top5": weak_top5,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _empty(self) -> dict[str, Any]:
        return {
            "counts": {},
            "points": [],
            "weak_top5": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
