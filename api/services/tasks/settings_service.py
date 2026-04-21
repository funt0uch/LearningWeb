"""
用户/客户端配置：落盘 data/settings.json，与运行时环境（如 Key 是否存在）合并返回。
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

DATA_ROOT = Path(r"E:\LearningWeb\data")
SETTINGS_FILE = DATA_ROOT / "settings.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    "version": 1,
    "theme": "light",
    "ocr_preference": True,
    "learning_prefs": {
        "daily_goal_minutes": 30,
        "review_reminder": True,
    },
    "ui": {
        "show_knowledge_graph": True,
        "weak_top_n": 5,
    },
}


def _ocr_runtime_enabled() -> bool:
    return os.environ.get("OCR_ENABLED", "1").strip().lower() not in ("0", "false", "no", "off")


def _api_key_configured() -> bool:
    return bool(
        (os.environ.get("ARK_API_KEY") or os.environ.get("DOUBAO_API_KEY") or "").strip(),
    )


class SettingsService:
    def load(self) -> dict[str, Any]:
        DATA_ROOT.mkdir(parents=True, exist_ok=True)
        if not SETTINGS_FILE.is_file():
            merged = self._with_runtime(deepcopy(DEFAULT_SETTINGS))
            self.save(merged)
            return merged
        try:
            raw = json.loads(SETTINGS_FILE.read_text(encoding="utf-8-sig"))
        except Exception:
            raw = {}
        base = deepcopy(DEFAULT_SETTINGS)
        self._deep_merge(base, raw)
        return self._with_runtime(base)

    def save(self, doc: dict[str, Any]) -> None:
        doc = deepcopy(doc)
        doc.pop("runtime", None)
        doc["version"] = int(doc.get("version", 1))
        SETTINGS_FILE.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        cur = self.load()
        for k in ("runtime",):
            cur.pop(k, None)
        self._deep_merge(cur, patch)
        self.save(cur)
        return self.load()

    def _with_runtime(self, doc: dict[str, Any]) -> dict[str, Any]:
        out = deepcopy(doc)
        out["runtime"] = {
            "api_key_configured": _api_key_configured(),
            "ocr_runtime_enabled": _ocr_runtime_enabled(),
        }
        return out

    def _deep_merge(self, base: dict[str, Any], over: dict[str, Any]) -> None:
        for k, v in over.items():
            if k == "runtime":
                continue
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                self._deep_merge(base[k], v)  # type: ignore[arg-type]
            else:
                base[k] = v
