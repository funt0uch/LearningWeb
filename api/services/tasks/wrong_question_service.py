from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Sequence

from services.llm.base import (
    ChatMessage,
    ChatRequest,
    ImageUrlContentPart,
    MultimodalChatRequest,
    TextContentPart,
)
from services.llm.router import get_llm

from .dedup_questions import dedupe_wrong_question_items, normalize_question_text
from .parser_service import ParserService, ParsedPdf
from .wrong_question_schema import WrongQuestionItemSchema, WrongQuestionOutputSchema

DATA_ROOT = Path(r"E:\LearningWeb\data")
GENERATED_DIR = DATA_ROOT / "generated"

log = logging.getLogger("learningweb.tasks.wrong_question")

DEFAULT_LLM_RETRIES = int(os.environ.get("WRONG_Q_LLM_RETRIES", "3"))
MAX_VISION_IMAGES = int(os.environ.get("WRONG_Q_MAX_VISION_IMAGES", "6"))
MAX_IMAGE_BYTES = int(os.environ.get("WRONG_Q_MAX_IMAGE_BYTES", str(4 * 1024 * 1024)))


@dataclass(frozen=True)
class WrongQuestionItem:
    question: str
    answer: str
    knowledge_point: str
    analysis: str
    difficulty: Literal["easy", "medium", "hard"]
    source_page: int
    related_image_paths: tuple[str, ...] = ()
    item_id: str = ""


@dataclass(frozen=True)
class WrongQuestionResult:
    items: Sequence[WrongQuestionItem]
    summary: str
    saved_path: str | None = None
    retries_used: int = 0
    degraded: bool = False
    vision_used: bool = False
    last_error: str | None = None
    attempt_log: tuple[str, ...] = field(default_factory=tuple)


JSON_INSTRUCTION = (
    "输出必须是严格 JSON（不要 markdown 代码块、不要前后说明），结构为：\n"
    "{\n"
    '  "schema_version": 1,\n'
    '  "summary": string,\n'
    '  "items": [\n'
    "    {\n"
    '      "question": string,\n'
    '      "answer": string,\n'
    '      "knowledge_point": string,\n'
    '      "analysis": string,\n'
    '      "difficulty": "easy"|"medium"|"hard",\n'
    '      "source_page": number,\n'
    '      "related_image_paths": string[]\n'
    "    }\n"
    "  ]\n"
    "}\n"
)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    t = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t, re.I)
    if fence:
        t = fence.group(1).strip()
    try:
        obj = json.loads(t)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass
    i, j = t.find("{"), t.rfind("}")
    if i >= 0 and j > i:
        try:
            obj = json.loads(t[i : j + 1])
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _validate_output(obj: dict[str, Any]) -> WrongQuestionOutputSchema | None:
    try:
        return WrongQuestionOutputSchema.model_validate(obj)
    except Exception as e:
        log.warning("JSON schema 校验失败: %s", e)
        return None


def _items_from_schema(s: WrongQuestionOutputSchema) -> list[WrongQuestionItem]:
    return [
        WrongQuestionItem(
            question=it.question,
            answer=it.answer or "",
            knowledge_point=it.knowledge_point,
            analysis=it.analysis,
            difficulty=it.difficulty,
            source_page=it.source_page,
            related_image_paths=tuple(it.related_image_paths or ()),
            item_id="",
        )
        for it in s.items
    ]


def _assign_item_ids(items: list[WrongQuestionItem]) -> list[WrongQuestionItem]:
    out: list[WrongQuestionItem] = []
    for it in items:
        raw = (
            f"{normalize_question_text(it.question)}|{it.source_page}|{it.knowledge_point}".encode(
                "utf-8",
            )
        )
        iid = hashlib.sha256(raw).hexdigest()[:16]
        out.append(
            WrongQuestionItem(
                question=it.question,
                answer=it.answer,
                knowledge_point=it.knowledge_point,
                analysis=it.analysis,
                difficulty=it.difficulty,
                source_page=it.source_page,
                related_image_paths=it.related_image_paths,
                item_id=iid,
            )
        )
    return out


def guess_knowledge_point(q: str) -> str:
    s = q.lower()
    if "lim" in s or "极限" in q:
        return "高数/极限"
    if "导" in q or "deriv" in s:
        return "高数/导数"
    if "矩阵" in q or "matrix" in s:
        return "线代/矩阵"
    return "未分类"


def _rule_based_items(candidates: list[dict]) -> WrongQuestionOutputSchema:
    items = [
        {
            "question": c["question_text"],
            "answer": "",
            "knowledge_point": guess_knowledge_point(c["question_text"]),
            "analysis": "（占位）LLM 不可用或输出未通过校验，请查看后端日志与 saved_path。",
            "difficulty": "medium",
            "source_page": int(c["source_page"]),
            "related_image_paths": [],
            "item_id": "",
        }
        for c in candidates
    ]
    return WrongQuestionOutputSchema(
        summary="（降级）已按规则抽取题干，等待 LLM 或校验通过。",
        items=[WrongQuestionItemSchema.model_validate(x) for x in items],
    )


async def _llm_chat_with_retries(
    *,
    build_user: str,
    retries: int,
    max_tokens: int,
    temperature: float,
) -> tuple[WrongQuestionOutputSchema | None, int, tuple[str, ...]]:
    llm = get_llm()
    logs: list[str] = []
    last_raw: str | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = await llm.chat(
                ChatRequest(
                    messages=[
                        ChatMessage(
                            role="system",
                            content=(
                                "你是学习资料库的AI错题整理助手。"
                                "用户会提供 PDF 抽取的题干候选或页面截图。"
                                + JSON_INSTRUCTION
                            ),
                        ),
                        ChatMessage(role="user", content=build_user),
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            )
            last_raw = resp.content
            obj = _extract_json_object(resp.content)
            validated = _validate_output(obj) if obj else None
            if validated:
                return validated, attempt, tuple(logs)
            logs.append(f"attempt {attempt}: 解析或 schema 校验失败")
            log.warning("LLM 输出未通过校验 attempt=%s raw_prefix=%s", attempt, (resp.content or "")[:200])
        except Exception as e:
            logs.append(f"attempt {attempt}: LLM 异常 {e!r}")
            if isinstance(e, RuntimeError) and "API Key" in str(e):
                log.warning("LLM 调用失败 attempt=%s: %s", attempt, e)
            else:
                log.exception("LLM 调用失败 attempt=%s", attempt)
    if last_raw:
        logs.append(f"最终原始输出前缀: {last_raw[:240]!r}")
    return None, retries, tuple(logs)


async def _llm_multimodal_with_retries(
    *,
    system: str,
    user_parts: list[Any],
    retries: int,
    max_tokens: int,
    temperature: float,
) -> tuple[WrongQuestionOutputSchema | None, int, tuple[str, ...]]:
    llm = get_llm()
    if not hasattr(llm, "chat_multimodal"):
        return None, 0, ("provider 不支持 chat_multimodal",)
    logs: list[str] = []
    last_raw: str | None = None
    for attempt in range(1, retries + 1):
        try:
            mm = getattr(llm, "chat_multimodal")
            resp = await mm(
                MultimodalChatRequest(
                    system=system,
                    user_parts=user_parts,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            )
            last_raw = resp.content
            obj = _extract_json_object(resp.content)
            validated = _validate_output(obj) if obj else None
            if validated:
                return validated, attempt, tuple(logs)
            logs.append(f"vision attempt {attempt}: 解析或 schema 校验失败")
            log.warning(
                "多模态输出未通过校验 attempt=%s prefix=%s",
                attempt,
                (resp.content or "")[:200],
            )
        except Exception as e:
            logs.append(f"vision attempt {attempt}: 异常 {e!r}")
            if isinstance(e, RuntimeError) and "API Key" in str(e):
                log.warning("多模态 LLM 失败 attempt=%s: %s", attempt, e)
            else:
                log.exception("多模态 LLM 失败 attempt=%s", attempt)
    if last_raw:
        logs.append(f"vision 最终输出前缀: {last_raw[:240]!r}")
    return None, retries, tuple(logs)


def _collect_vision_parts(parsed: ParsedPdf) -> list[ImageUrlContentPart | TextContentPart]:
    parts: list[ImageUrlContentPart | TextContentPart] = []
    n = 0
    meta_lines: list[str] = []
    for p in parsed.pages:
        for im in p.images:
            if n >= MAX_VISION_IMAGES:
                break
            ip = Path(str(im.get("path", "")))
            if not ip.is_file():
                continue
            size = ip.stat().st_size
            if size > MAX_IMAGE_BYTES:
                log.warning("跳过过大图片: %s bytes=%s", ip, size)
                continue
            b64 = base64.standard_b64encode(ip.read_bytes()).decode("ascii")
            mime = str(im.get("mime") or "image/png")
            url = f"data:{mime};base64,{b64}"
            parts.append(ImageUrlContentPart(type="image_url", url=url))
            meta_lines.append(f"- 第{p.page}页 图片 {im.get('name')} -> {ip}")
            n += 1
        if n >= MAX_VISION_IMAGES:
            break
    if meta_lines:
        parts.insert(0, TextContentPart(type="text", text="【页面图片元数据】\n" + "\n".join(meta_lines)))
    return parts


class WrongQuestionService:
    """
    错题整理：PDF → 解析 →（可选多模态）→ LLM → Pydantic 严格校验 → 落盘 JSON。
    LLM 默认重试 WRONG_Q_LLM_RETRIES 次（默认 3）。
    """

    def _extract_candidates(self, parsed: ParsedPdf) -> list[dict]:
        out: list[dict] = []
        for p in parsed.pages:
            t = (p.text or "").strip()
            if not t:
                continue
            parts = re.split(r"(?:^|\n)\s*(?:\d+\s*[\.、]|（\d+）)\s*", t)
            parts = [x.strip() for x in parts if x.strip()]
            if not parts:
                continue
            for chunk in parts[:20]:
                if len(chunk) < 8:
                    continue
                out.append({"source_page": p.page, "question_text": chunk[:2000]})
        return out[:30]

    async def organize_from_text(self, *, raw_text: str) -> WrongQuestionResult:
        """保留旧接口：仅文本走 LLM，不强制与 PDF schema 完全一致。"""
        llm = get_llm()
        resp = await llm.chat(
            ChatRequest(
                messages=[
                    ChatMessage(role="system", content="你是学习助手。用简洁中文回答。"),
                    ChatMessage(role="user", content=raw_text),
                ],
                temperature=0.2,
                max_tokens=800,
            )
        )
        one = WrongQuestionItem(
            question=raw_text[:500],
            answer="",
            knowledge_point="未分类",
            analysis=resp.content,
            difficulty="medium",
            source_page=1,
            related_image_paths=(),
            item_id="",
        )
        with_id = _assign_item_ids([one])
        return WrongQuestionResult(items=tuple(with_id), summary="（organize_from_text 占位结构化）", degraded=True)

    async def organize_from_pdf(self, *, path: str) -> WrongQuestionResult:
        retries = DEFAULT_LLM_RETRIES
        parser = ParserService()
        parsed = parser.parse_pdf(path=path)
        candidates = self._extract_candidates(parsed)

        merged_items: list[WrongQuestionItem] = []
        summary_parts: list[str] = []
        total_retries = 0
        all_logs: list[str] = []
        vision_used = False

        # --- 多模态：含图页面 ---
        img_parts = _collect_vision_parts(parsed)
        if any(isinstance(p, ImageUrlContentPart) for p in img_parts):
            vision_used = True
            sys_v = (
                "你是 OCR/读图助手，请识别图中数学题或文字题并整理为结构化 JSON。"
                + JSON_INSTRUCTION
                + "related_image_paths 请填抽取时对应的本地图片路径（若文本元数据中有）。\n"
            )
            tail = [
                TextContentPart(
                    type="text",
                    text=(
                        "请仅根据以上图片与元数据输出 JSON。"
                        f"\n【PDF】{path}\n"
                        "【页面文本摘要】\n"
                        + json.dumps(
                            [{"page": p.page, "text_preview": (p.text or "")[:400]} for p in parsed.pages],
                            ensure_ascii=False,
                        )
                    ),
                )
            ]
            user_parts = list(img_parts) + tail
            v_schema, used_v, logs_v = await _llm_multimodal_with_retries(
                system=sys_v,
                user_parts=user_parts,
                retries=retries,
                max_tokens=2000,
                temperature=0.2,
            )
            total_retries += used_v
            all_logs.extend(logs_v)
            if v_schema:
                merged_items.extend(_items_from_schema(v_schema))
                summary_parts.append(v_schema.summary)

        # --- 文本 LLM：候选题干 ---
        user_txt = (
            "请根据以下候选题目生成错题结构化结果。\n\n"
            f"【PDF 路径】{path}\n"
            "【候选题目】\n"
            + json.dumps(candidates, ensure_ascii=False, indent=2)
            + "\n\n"
            + JSON_INSTRUCTION
            + "若无可用候选，可输出 items 为空数组。\n"
        )

        t_schema, used_t, logs_t = await _llm_chat_with_retries(
            build_user=user_txt,
            retries=retries,
            max_tokens=2000,
            temperature=0.2,
        )
        total_retries += used_t
        all_logs.extend(logs_t)

        degraded = False
        last_err: str | None = None

        if t_schema:
            merged_items.extend(_items_from_schema(t_schema))
            summary_parts.append(t_schema.summary)
        elif candidates:
            fb = _rule_based_items(candidates)
            merged_items.extend(_items_from_schema(fb))
            summary_parts.append(fb.summary)
            degraded = True
            last_err = "文本 LLM 未产出可校验 JSON，已降级规则抽取"

        sim_th = float(os.environ.get("DEDUP_SIMILARITY", "0.85"))
        merged_deduped = dedupe_wrong_question_items(merged_items, similarity_threshold=sim_th)
        deduped = _assign_item_ids(merged_deduped)

        final_summary = "；".join(summary_parts) if summary_parts else "（无摘要）"
        if not deduped and not candidates and not vision_used:
            final_summary = "PDF 无文本且无可用图片，未生成题目。"
            degraded = True

        out_schema = WrongQuestionOutputSchema.model_validate(
            {
                "schema_version": 1,
                "summary": final_summary,
                "items": [
                    {
                        "question": x.question,
                        "answer": x.answer,
                        "knowledge_point": x.knowledge_point,
                        "analysis": x.analysis,
                        "difficulty": x.difficulty,
                        "source_page": x.source_page,
                        "related_image_paths": list(x.related_image_paths),
                        "item_id": x.item_id,
                    }
                    for x in deduped
                ],
            }
        )

        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out_path = GENERATED_DIR / f"wrong_questions_{ts}.json"
        payload = {
            "schema_version": out_schema.schema_version,
            "summary": out_schema.summary,
            "items": [asdict(x) for x in deduped],
            "meta": {
                "pdf_path": path,
                "retries_total": total_retries,
                "degraded": degraded,
                "vision_used": vision_used,
                "attempt_log": list(all_logs),
                "last_error": last_err,
            },
        }
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        return WrongQuestionResult(
            items=tuple(deduped),
            summary=final_summary,
            saved_path=str(out_path),
            retries_used=total_retries,
            degraded=degraded,
            vision_used=vision_used,
            last_error=last_err,
            attempt_log=tuple(all_logs),
        )
