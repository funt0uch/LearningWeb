"""按 item_id 从落盘 JSON 中查找错题条目。"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .parser_service import DATA_ROOT

log = logging.getLogger("learningweb.tasks.wrong_item_lookup")

GENERATED_DIR = DATA_ROOT / "generated"


def find_item(item_id: str) -> dict[str, Any] | None:
    if not item_id or len(item_id) < 8:
        return None
    if not GENERATED_DIR.is_dir():
        return None
    for fp in sorted(GENERATED_DIR.glob("wrong_questions_*.json"), reverse=True):
        try:
            data = json.loads(fp.read_text(encoding="utf-8-sig"))
        except Exception as e:
            log.debug("skip %s: %s", fp, e)
            continue
        for it in data.get("items", []) or []:
            if str(it.get("item_id", "")) == item_id:
                meta = data.get("meta") or {}
                return {
                    **it,
                    "source_file": str(fp),
                    "_pdf_path": meta.get("pdf_path"),
                }
    return None
