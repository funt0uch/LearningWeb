"""学习资料库 · 本地数据 API（读写 E:\\LearningWeb\\data 下的 JSON 与文件）。"""

from __future__ import annotations

import logging
import mimetypes
import json
import os
import re
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

DATA_ROOT = Path(r"E:\LearningWeb\data")
SUBDIRS = ("folders", "files", "generated", "temp")
FOLDERS_FILE = DATA_ROOT / "folders.json"
FILES_INDEX_FILE = DATA_ROOT / "files_index.json"
FILES_DIR = DATA_ROOT / "files"

_log = logging.getLogger(__name__)


def _read_text_resilient(path: Path) -> str:
    """
    读取本地 JSON 配置文件：兼容 BOM、误用系统默认编码（如 GBK）保存、或偶发非法 UTF-8 字节。
    """
    raw = path.read_bytes()
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            return raw.decode("utf-16")
        except UnicodeDecodeError:
            pass
    for encoding in ("utf-8-sig", "utf-8", "gbk", "cp936"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    _log.warning(
        "%s 无法用 utf-8/gbk 解码，已使用替换字符，建议用 UTF-8 重新保存",
        path,
    )
    return raw.decode("utf-8", errors="replace")


def _load_json_file(path: Path) -> Any:
    return json.loads(_read_text_resilient(path))


DEFAULT_STATE: dict[str, Any] = {
    "version": 1,
    "tree": [
        {
            "id": "math",
            "label": "数学",
            "children": [
                {"id": "calculus", "label": "高数"},
                {"id": "linear", "label": "线代"},
            ],
        },
        {"id": "exams", "label": "考试试卷"},
        {"id": "mistakes", "label": "错题整理"},
    ],
    "selectedFolderId": "calculus",
    "expandedFolderIds": ["math"],
}


def ensure_layout() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    for name in SUBDIRS:
        (DATA_ROOT / name).mkdir(parents=True, exist_ok=True)
    if not FOLDERS_FILE.is_file():
        FOLDERS_FILE.write_text(
            json.dumps(DEFAULT_STATE, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if not FILES_INDEX_FILE.is_file():
        FILES_INDEX_FILE.write_text(
            json.dumps({"version": 1, "files": []}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def _load_files_index() -> dict[str, Any]:
    ensure_layout()
    return _load_json_file(FILES_INDEX_FILE)


def _save_files_index(doc: dict[str, Any]) -> None:
    FILES_INDEX_FILE.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


_FILENAME_RE = re.compile(r'[^0-9A-Za-z\u4e00-\u9fff\.\-\_\(\)\s]+')


def _sanitize_filename(name: str) -> str:
    name = name.strip().replace("\\", "_").replace("/", "_")
    name = _FILENAME_RE.sub("_", name)
    # 防止隐藏/空文件名
    name = name.lstrip(".") or "unnamed"
    return name[:180]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_layout()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    yield


app = FastAPI(title="LearningWeb Folder API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):3000$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/folders-state")
def get_folders_state() -> dict[str, Any]:
    ensure_layout()
    try:
        return _load_json_file(FOLDERS_FILE)
    except json.JSONDecodeError as e:
        _log.error("folders.json 解析失败: %s", e)
        raise HTTPException(
            status_code=500,
            detail="folders.json 格式损坏，请检查文件是否为合法 JSON，或删除后由服务自动重建默认目录",
        ) from e


@app.put("/api/folders-state")
def put_folders_state(payload: dict[str, Any]) -> dict[str, bool]:
    if not isinstance(payload.get("tree"), list):
        raise HTTPException(status_code=400, detail="body.tree must be an array")
    if "selectedFolderId" not in payload:
        raise HTTPException(status_code=400, detail="missing selectedFolderId")
    if not isinstance(payload.get("expandedFolderIds"), list):
        raise HTTPException(status_code=400, detail="body.expandedFolderIds must be an array")

    out = {
        "version": int(payload.get("version", 1)),
        "tree": payload["tree"],
        "selectedFolderId": payload["selectedFolderId"],
        "expandedFolderIds": list(payload["expandedFolderIds"]),
    }
    ensure_layout()
    FOLDERS_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@app.post("/api/upload")
async def upload_file(
    folder_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """
    上传文件到 E:\\LearningWeb\\data\\files\\{folder_id}\\ 下，并写入 files_index.json。
    """
    ensure_layout()
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id is required")

    safe_name = _sanitize_filename(file.filename or "unnamed")
    folder_dir = FILES_DIR / folder_id
    folder_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4().hex
    dest = folder_dir / safe_name

    # 若同名，追加 (n)
    if dest.exists():
        stem, ext = os.path.splitext(safe_name)
        i = 2
        while True:
            cand = folder_dir / f"{stem} ({i}){ext}"
            if not cand.exists():
                dest = cand
                break
            i += 1

    content = await file.read()
    dest.write_bytes(content)

    mime = file.content_type or mimetypes.guess_type(dest.name)[0] or "application/octet-stream"
    size = dest.stat().st_size

    idx = _load_files_index()
    entry = {
        "id": file_id,
        "name": dest.name,
        "path": str(dest),
        "type": mime,
        "size": size,
        "uploadedAt": _now_iso(),
        "folderId": folder_id,
    }
    idx["files"] = [entry, *list(idx.get("files", []))]
    _save_files_index(idx)
    return entry


@app.get("/api/files/{folder_id}")
def list_files(folder_id: str) -> list[dict[str, Any]]:
    ensure_layout()
    idx = _load_files_index()
    return [f for f in list(idx.get("files", [])) if f.get("folderId") == folder_id]


@app.get("/api/file/{file_id}")
def download_file(file_id: str):
    ensure_layout()
    idx = _load_files_index()
    files = list(idx.get("files", []))
    hit = next((f for f in files if f.get("id") == file_id), None)
    if not hit:
        raise HTTPException(status_code=404, detail="file not found")
    path = Path(str(hit.get("path", "")))
    if not path.is_file():
        raise HTTPException(status_code=404, detail="file missing on disk")
    media_type = str(hit.get("type") or "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=path.name)


class WrongQuestionsFromPdfBody(BaseModel):
    file_id: str | None = None
    path: str | None = None


def _resolve_task_pdf_path(body: WrongQuestionsFromPdfBody) -> Path:
    if body.file_id:
        idx = _load_files_index()
        files = list(idx.get("files", []))
        hit = next((f for f in files if f.get("id") == body.file_id), None)
        if not hit:
            raise HTTPException(status_code=404, detail="file not found")
        p = Path(str(hit.get("path", "")))
    elif body.path:
        p = Path(body.path)
    else:
        raise HTTPException(status_code=400, detail="请提供 file_id 或 path")

    if not p.is_file():
        raise HTTPException(status_code=404, detail="file missing on disk")

    data_abs = DATA_ROOT.resolve()
    try:
        p.resolve().relative_to(data_abs)
    except ValueError:
        raise HTTPException(status_code=400, detail="path must be under data root")

    if p.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="only .pdf supported")
    return p


class ApiChatBody(BaseModel):
    message: str
    mode: str | None = None  # explain | summarize | similar | free
    image_urls: list[str] | None = None


@app.post("/api/chat")
async def api_chat(body: ApiChatBody) -> dict[str, Any]:
    """学习助手对话：解释题、总结知识、相似题等。"""
    from services.tasks.chat_service import tutor_chat

    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="message is required")
    try:
        reply = await tutor_chat(user_message=msg, mode=body.mode, image_urls=body.image_urls)
        try:
            from services.tasks.study_history_service import StudyHistoryService

            StudyHistoryService().append_event(
                action="chat",
                meta={"preview": msg[:240], "mode": body.mode or "free"},
            )
        except Exception:
            pass
        return {"ok": True, "reply": reply, "mode": body.mode or "free"}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        _log.exception("chat failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


class StudyEventBody(BaseModel):
    action: str
    item_id: str | None = None
    meta: dict[str, Any] | None = None


@app.post("/api/study/event")
def api_study_event(body: StudyEventBody) -> dict[str, Any]:
    """学习行为打点：view / chat / session / practice_* 等。"""
    from services.tasks.study_history_service import StudyHistoryService

    act = (body.action or "").strip()
    if not act:
        raise HTTPException(status_code=400, detail="action is required")
    ev = StudyHistoryService().append_event(
        action=act,
        item_id=body.item_id,
        meta=body.meta,
    )
    return {"ok": True, "event": ev}


@app.get("/api/study/events")
def api_study_events(limit: int = 200) -> dict[str, Any]:
    from services.tasks.study_history_service import StudyHistoryService

    return {"ok": True, "events": StudyHistoryService().list_events(limit=max(1, min(limit, 2000)))}


@app.get("/api/study/summary")
def api_study_summary() -> dict[str, Any]:
    from services.tasks.study_history_service import StudyHistoryService

    return {"ok": True, **StudyHistoryService().summary()}


@app.get("/api/review/recommendations")
def api_review_recommendations(top_n: int = 8) -> dict[str, Any]:
    from services.tasks.review_recommend_service import ReviewRecommendService

    return {"ok": True, **ReviewRecommendService().recommend_today(top_n=max(1, min(top_n, 30)))}


class PracticeGenerateBody(BaseModel):
    item_id: str


class PracticeSubmitBody(BaseModel):
    practice_id: str
    answer: str


@app.post("/api/practice/generate")
async def api_practice_generate(body: PracticeGenerateBody) -> dict[str, Any]:
    from services.tasks.practice_generator_service import PracticeGeneratorService

    try:
        out = await PracticeGeneratorService().generate(item_id=body.item_id)
        return {"ok": True, **out}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        _log.exception("practice generate")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/practice/submit")
async def api_practice_submit(body: PracticeSubmitBody) -> dict[str, Any]:
    from services.tasks.practice_generator_service import PracticeGeneratorService

    if not (body.answer or "").strip():
        raise HTTPException(status_code=400, detail="answer is required")
    try:
        out = await PracticeGeneratorService().submit_answer(
            practice_id=body.practice_id,
            user_answer=body.answer.strip(),
        )
        return {"ok": True, **out}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        _log.exception("practice submit")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/knowledge/graph")
def api_knowledge_graph() -> dict[str, Any]:
    from services.tasks.knowledge_graph_service import build_from_points
    from services.tasks.knowledge_stats_service import KnowledgeStatsService

    ks = KnowledgeStatsService().aggregate()
    pts = list(ks.get("points") or [])
    g = build_from_points(pts)
    return {"ok": True, **g, "stats_generated_at": ks.get("generated_at")}


@app.get("/api/settings")
def api_get_settings() -> dict[str, Any]:
    from services.tasks.settings_service import SettingsService

    return {"ok": True, "settings": SettingsService().load()}


class SettingsPatchBody(BaseModel):
    theme: str | None = None
    ocr_preference: bool | None = None
    learning_prefs: dict[str, Any] | None = None
    ui: dict[str, Any] | None = None


@app.put("/api/settings")
def api_put_settings(body: SettingsPatchBody) -> dict[str, Any]:
    from services.tasks.settings_service import SettingsService

    patch = body.model_dump(exclude_none=True)
    merged = SettingsService().update(patch)
    return {"ok": True, "settings": merged}


@app.get("/api/dashboard/overview")
def api_dashboard_overview() -> dict[str, Any]:
    from services.tasks.dashboard_service import DashboardService

    return {"ok": True, **DashboardService().overview()}


@app.get("/api/reports/weekly")
async def api_weekly_report() -> dict[str, Any]:
    from services.tasks.weekly_report_service import WeeklyReportService

    try:
        return {"ok": True, **await WeeklyReportService().generate()}
    except Exception as e:
        _log.exception("weekly report")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/knowledge/stats")
def api_knowledge_stats() -> dict[str, Any]:
    from services.tasks.knowledge_stats_service import KnowledgeStatsService

    return KnowledgeStatsService().aggregate()


@app.get("/api/wrong-items/{item_id}")
def api_get_wrong_item(item_id: str) -> dict[str, Any]:
    from services.tasks.wrong_item_lookup import find_item

    hit = find_item(item_id.strip())
    if not hit:
        raise HTTPException(status_code=404, detail="item not found")
    return {"ok": True, "item": hit}


@app.post("/api/tasks/wrong-questions/from-pdf")
async def wrong_questions_from_pdf(body: WrongQuestionsFromPdfBody) -> dict[str, Any]:
    """
    错题整理：解析 PDF →（可选多模态）→ LLM（失败自动重试）→ 严格 JSON Schema → 落盘。
    """
    path = _resolve_task_pdf_path(body)
    from services.tasks.wrong_question_service import WrongQuestionService

    svc = WrongQuestionService()
    r = await svc.organize_from_pdf(path=str(path))
    items = [
        {
            "question": x.question,
            "answer": x.answer,
            "knowledge_point": x.knowledge_point,
            "analysis": x.analysis,
            "difficulty": x.difficulty,
            "source_page": x.source_page,
            "related_image_paths": list(x.related_image_paths),
            "item_id": getattr(x, "item_id", "") or "",
        }
        for x in r.items
    ]
    return {
        "ok": True,
        "schema_version": 1,
        "summary": r.summary,
        "items": items,
        "saved_path": r.saved_path,
        "retries_used": r.retries_used,
        "degraded": r.degraded,
        "vision_used": r.vision_used,
        "last_error": r.last_error,
        "attempt_log": list(r.attempt_log),
    }


@app.delete("/api/file/{file_id}")
def delete_file(file_id: str) -> dict[str, bool]:
    ensure_layout()
    idx = _load_files_index()
    files = list(idx.get("files", []))
    hit = next((f for f in files if f.get("id") == file_id), None)
    if not hit:
        raise HTTPException(status_code=404, detail="file not found")

    path = Path(str(hit.get("path", "")))
    if path.is_file():
        path.unlink(missing_ok=True)  # py>=3.8

    idx["files"] = [f for f in files if f.get("id") != file_id]
    _save_files_index(idx)
    return {"ok": True}


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
