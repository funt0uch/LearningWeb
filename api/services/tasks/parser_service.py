from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal, Sequence

import fitz  # PyMuPDF

from . import ocr_service

_log = logging.getLogger(__name__)

# 少于此字符数（去空白后）认为“无文本层/需 OCR”（扫描件、拍照 PDF）
OCR_TEXT_MIN_CHARS = int(os.environ.get("OCR_TEXT_MIN_CHARS", "40"))


DocType = Literal["pdf", "image", "docx", "txt", "unknown"]

DATA_ROOT = Path(r"E:\LearningWeb\data")
GENERATED_DIR = DATA_ROOT / "generated"


@dataclass(frozen=True)
class ParsedDocument:
    """
    解析层输出：给 task 层（错题整理/多模态理解/试卷生成）提供统一输入。
    第四阶段将逐步填充：PDF 文本抽取 / OCR / 版面结构 / 图片理解等。
    """

    doc_type: DocType
    text: str
    meta: dict


@dataclass(frozen=True)
class ParsedPdfPage:
    page: int
    text: str
    images: Sequence[dict]  # [{name, path, mime, width, height}]
    ocr_used: bool = False  # 本页文本是否由 OCR 得到


@dataclass(frozen=True)
class ParsedPdf:
    doc_type: Literal["pdf"]
    pages: Sequence[ParsedPdfPage]
    meta: dict


class ParserService:
    """
    任务编排层的一部分：负责“解析”能力聚合。
    注意：此处不调用 LLM；LLM 调用只应发生在需要推理/结构化的任务服务中。
    """

    def parse_file(self, *, path: str) -> ParsedDocument:
        """根据扩展名分发；图片走 OCR，其余暂不支持。"""
        p = Path(path)
        if not p.is_file():
            raise FileNotFoundError(path)
        suf = p.suffix.lower()
        if suf in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            from . import ocr_service

            text = ocr_service.ocr_image_path(p)
            return ParsedDocument(
                doc_type="image",
                text=text,
                meta={"path": str(p), "ocr": True},
            )
        if suf == ".pdf":
            pdf = self.parse_pdf(path=path)
            full = "\n\n".join((pg.text or "") for pg in pdf.pages)
            return ParsedDocument(doc_type="pdf", text=full, meta=dict(pdf.meta))
        raise NotImplementedError(f"暂不支持的文件类型: {suf}")

    def parse_pdf(self, *, path: str) -> ParsedPdf:
        """
        使用 PyMuPDF 解析 PDF：
        - 页码
        - 页面文本
        - 页面图片（落盘到 E:\\LearningWeb\\data\\generated\\pdf_assets\\...）
        - 原始元数据
        """

        src = Path(path)
        if not src.is_file():
            raise FileNotFoundError(f"PDF 不存在: {path}")

        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        assets_root = GENERATED_DIR / "pdf_assets"
        assets_root.mkdir(parents=True, exist_ok=True)

        sig = f"{src.resolve()}|{src.stat().st_mtime_ns}|{src.stat().st_size}".encode("utf-8")
        key = hashlib.sha256(sig).hexdigest()[:16]
        out_dir = assets_root / f"pdf_{key}"
        out_dir.mkdir(parents=True, exist_ok=True)

        doc = fitz.open(str(src))
        meta = dict(doc.metadata or {})
        meta.update(
            {
                "path": str(src),
                "page_count": doc.page_count,
                "assets_dir": str(out_dir),
            }
        )

        pages: list[ParsedPdfPage] = []
        ocr_pages: list[int] = []
        for i in range(doc.page_count):
            page = doc.load_page(i)
            text = page.get_text("text") or ""
            ocr_used = False

            if len(text.strip()) < OCR_TEXT_MIN_CHARS:
                zoom = float(os.environ.get("OCR_PAGE_RENDER_ZOOM", "2.0"))
                mat = fitz.Matrix(zoom, zoom)
                try:
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    png = pix.tobytes("png")
                    ocr_text = ocr_service.ocr_pdf_page_pixmap_png_bytes(png)
                    if ocr_text:
                        text = ocr_text
                        ocr_used = True
                        ocr_pages.append(i + 1)
                    elif not text.strip():
                        _log.debug("第 %s 页 OCR 无结果，保留原文本层（可能为空）", i + 1)
                except Exception:
                    _log.exception("第 %s 页 OCR 失败", i + 1)

            images_out: list[dict] = []
            for img_idx, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                pix = fitz.Pixmap(doc, xref)
                try:
                    if pix.n >= 5:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    name = f"page_{i+1:03d}_{img_idx+1:02d}.png"
                    p = out_dir / name
                    pix.save(str(p))
                    images_out.append(
                        {
                            "name": name,
                            "path": str(p),
                            "mime": "image/png",
                            "width": pix.width,
                            "height": pix.height,
                        }
                    )
                finally:
                    # Pixmap 释放由 GC 处理；显式置空以降低内存峰值
                    pix = None

            pages.append(
                ParsedPdfPage(page=i + 1, text=text, images=images_out, ocr_used=ocr_used),
            )

        doc.close()
        meta["ocr_pages"] = ocr_pages
        meta["ocr_page_count"] = len(ocr_pages)
        return ParsedPdf(doc_type="pdf", pages=pages, meta=meta)

    def dump_parsed_pdf_json(self, parsed: ParsedPdf) -> dict:
        return asdict(parsed)

