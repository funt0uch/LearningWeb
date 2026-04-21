"""
错题再练：基于错题生成同类练习题，用户提交答案后由 LLM 评估。
练习会话落盘：data/generated/practice_sessions/{practice_id}.json
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from services.llm.base import ChatMessage, ChatRequest
from services.llm.router import get_llm

from .wrong_item_lookup import find_item

DATA_ROOT = Path(r"E:\LearningWeb\data")
PRACTICE_DIR = DATA_ROOT / "generated" / "practice_sessions"

log = logging.getLogger("learningweb.tasks.practice")


def _extract_json(text: str) -> dict[str, Any] | None:
    import re

    t = (text or "").strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t)
    if m:
        t = m.group(1).strip()
    try:
        o = json.loads(t)
        return o if isinstance(o, dict) else None
    except Exception:
        i, j = t.find("{"), t.rfind("}")
        if i >= 0 and j > i:
            try:
                o = json.loads(t[i : j + 1])
                return o if isinstance(o, dict) else None
            except Exception:
                return None
    return None


class PracticeGeneratorService:
    async def generate(self, *, item_id: str) -> dict[str, Any]:
        item = find_item(item_id.strip())
        if not item:
            raise ValueError("找不到该错题")

        PRACTICE_DIR.mkdir(parents=True, exist_ok=True)
        pid = uuid.uuid4().hex
        stem = str(item.get("question", ""))[:1200]
        kp = str(item.get("knowledge_point", ""))
        diff = str(item.get("difficulty", "medium"))

        llm = get_llm()
        prompt = (
            "请根据下方错题，**再出 1 道考察相同知识点的练习题**（题干不同、难度接近）。\n"
            "只输出 JSON：\n"
            '{"stem":"题干文本","reference_answer":"参考答案要点"}\n\n"
            f"【原题】{stem}\n【知识点】{kp}\n【难度】{diff}\n"
        )
        resp = await llm.chat(
            ChatRequest(
                messages=[
                    ChatMessage(role="system", content="你是教学助理，只输出合法 JSON，不要 markdown。"),
                    ChatMessage(role="user", content=prompt),
                ],
                temperature=0.35,
                max_tokens=int(os.environ.get("PRACTICE_GEN_MAX_TOKENS", "1200")),
            )
        )
        obj = _extract_json(resp.content) or {}
        stem_out = str(obj.get("stem") or obj.get("question") or "").strip()
        ref = str(obj.get("reference_answer") or obj.get("answer") or "").strip()
        if not stem_out:
            stem_out = "（生成失败，请稍后重试或检查 LLM 配置）"

        record = {
            "practice_id": pid,
            "source_item_id": item_id,
            "stem": stem_out,
            "reference_answer": ref,
            "knowledge_point": kp,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "llm_raw": resp.content[:4000],
        }
        (PRACTICE_DIR / f"{pid}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return {
            "practice_id": pid,
            "stem": stem_out,
            "knowledge_point": kp,
        }

    async def submit_answer(self, *, practice_id: str, user_answer: str) -> dict[str, Any]:
        path = PRACTICE_DIR / f"{practice_id.strip()}.json"
        if not path.is_file():
            raise ValueError("练习不存在或已过期")
        rec = json.loads(path.read_text(encoding="utf-8-sig"))
        stem = rec.get("stem", "")
        ref = rec.get("reference_answer", "")
        kp = rec.get("knowledge_point", "")

        llm = get_llm()
        prompt = (
            "你是阅卷助教。请评估学生的作答，并给出简要改进建议。\n"
            "只输出 JSON：\n"
            '{"score": 0-100 的整数,"verdict":"对/部分对/错","feedback":"中文短评"}\n\n'
            f"【知识点】{kp}\n【练习题】{stem}\n【参考答案要点】{ref}\n【学生作答】{user_answer}\n"
        )
        resp = await llm.chat(
            ChatRequest(
                messages=[
                    ChatMessage(role="system", content="你是严谨的阅卷助教，只输出 JSON。"),
                    ChatMessage(role="user", content=prompt),
                ],
                temperature=0.2,
                max_tokens=800,
            )
        )
        ev = _extract_json(resp.content) or {}
        out = {
            "practice_id": practice_id,
            "score": int(ev.get("score", 0)) if str(ev.get("score", "")).isdigit() else None,
            "verdict": str(ev.get("verdict", "")),
            "feedback": str(ev.get("feedback", resp.content[:2000])),
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        rec["last_evaluation"] = out
        path.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
        return out
