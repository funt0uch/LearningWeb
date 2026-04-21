"""错题条目去重：题干相似度、同页、关联图片路径。"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


def normalize_question_text(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip())


def dedupe_wrong_question_items(
    items: list[Any],
    *,
    similarity_threshold: float = 0.85,
) -> list[Any]:
    """
    - 文本：SequenceMatcher 与已保留项比较，超过阈值视为重复丢弃
    - 页码 + 图片路径集合完全相同：视为同一来源重复
    """
    out: list[Any] = []
    for it in items:
        is_dup = False
        paths_a = tuple(sorted(it.related_image_paths))
        for prev in out:
            paths_b = tuple(sorted(prev.related_image_paths))
            if paths_a and paths_a == paths_b and it.source_page == prev.source_page:
                is_dup = True
                break
            ra = normalize_question_text(it.question)
            rb = normalize_question_text(prev.question)
            if len(ra) < 4 or len(rb) < 4:
                continue
            ratio = SequenceMatcher(None, ra, rb).ratio()
            if ratio >= similarity_threshold:
                is_dup = True
                break
        if not is_dup:
            out.append(it)
    return out
