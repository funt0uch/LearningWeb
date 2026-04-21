"""
知识点层级图：将「高数/导数」类路径拆成树，叶子挂载错题统计 _meta。
"""

from __future__ import annotations

import re
from typing import Any


def _split_path(name: str) -> list[str]:
    s = (name or "").strip() or "未分类"
    parts = re.split(r"[/／>\\|、]", s)
    return [p.strip() for p in parts if p.strip()]


def build_from_points(points: list[dict[str, Any]]) -> dict[str, Any]:
    """由 knowledge_stats 的 points 构建嵌套 tree。"""
    tree: dict[str, Any] = {}

    for p in points:
        name = str(p.get("name", "未分类"))
        path = _split_path(name)
        meta = {
            "wrong_count": int(p.get("wrong_count", 0) or 0),
            "avg_difficulty": round(float(p.get("avg_difficulty", 2) or 2), 3),
            "last_wrong_at": p.get("last_wrong_at"),
            "full_label": name,
        }
        cur: dict[str, Any] = tree
        for i, seg in enumerate(path):
            last = i == len(path) - 1
            if seg not in cur:
                cur[seg] = {}
            node = cur[seg]
            if last:
                node["_meta"] = meta
            cur = node

    flat = [str(p.get("name")) for p in points]
    return {"tree": tree, "flat_labels": flat}
