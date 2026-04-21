"""
OCR 服务（优先 PaddleOCR）。

- 图片（jpg/png 等）→ 文本
- PDF 页渲染为图后 → 文本（由 parser_service 在无文本层时调用）

依赖（需单独安装）::

    pip install paddlepaddle paddleocr

未安装时：相关函数返回空字符串并打 warning（不阻塞服务启动）。
环境变量：

- OCR_ENABLED: 设为 "0" / "false" 时强制关闭 OCR
- OCR_TEXT_MIN_CHARS: parser 判定“文本过短触发 OCR”的阈值（默认见 parser）
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

log = logging.getLogger("learningweb.tasks.ocr")


def _ocr_disabled() -> bool:
    v = os.environ.get("OCR_ENABLED", "1").strip().lower()
    return v in ("0", "false", "no", "off")


@lru_cache(maxsize=1)
def _get_paddle_ocr() -> Any | None:
    if _ocr_disabled():
        log.info("OCR 已关闭 (OCR_ENABLED)")
        return None
    try:
        from paddleocr import PaddleOCR  # type: ignore[import-untyped]

        # 中文 + 方向分类；CPU 可跑，首次加载较慢
        return PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
    except Exception as e:
        log.warning("PaddleOCR 不可用（未安装或加载失败）：%s", e)
        return None


def _lines_from_paddle_result(result: Any) -> str:
    """PaddleOCR 返回格式: [[[box], (text, conf)], ...] 或旧版差异兼容。"""
    if not result:
        return ""
    block = result[0] if isinstance(result, (list, tuple)) else result
    if not block:
        return ""
    texts: list[str] = []
    for line in block:
        try:
            if line is None:
                continue
            # line: [box, (text, score)] or [box, [text, score]]
            if len(line) >= 2:
                cell = line[1]
                if isinstance(cell, (list, tuple)) and len(cell) >= 1:
                    texts.append(str(cell[0]))
                elif isinstance(cell, str):
                    texts.append(cell)
        except (TypeError, IndexError, ValueError):
            continue
    return "\n".join(t for t in texts if t)


def ocr_image_path(path: str | Path) -> str:
    """
    对本地图片文件做 OCR，返回整页合并文本（换行连接）。
    支持 jpg / png / webp 等 Pillow 能打开的常见格式。
    """
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(str(p))
    ocr = _get_paddle_ocr()
    if ocr is None:
        return ""
    try:
        result = ocr.ocr(str(p), cls=True)
        return _lines_from_paddle_result(result).strip()
    except Exception as e:
        log.exception("OCR 图片失败: %s", p)
        return ""


def ocr_image_bytes(data: bytes, *, suffix: str = ".png") -> str:
    """对内存中的图片字节做 OCR（写入临时文件再识别，保证兼容性）。"""
    import tempfile

    ocr = _get_paddle_ocr()
    if ocr is None or not data:
        return ""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = f.name
    try:
        result = ocr.ocr(tmp, cls=True)
        return _lines_from_paddle_result(result).strip()
    except Exception:
        log.exception("OCR 字节流失败")
        return ""
    finally:
        Path(tmp).unlink(missing_ok=True)


def ocr_pdf_page_pixmap_png_bytes(png_bytes: bytes) -> str:
    """对单页 PDF 渲染得到的 PNG 字节做 OCR。"""
    return ocr_image_bytes(png_bytes, suffix=".png")


def ocr_pdf_file(path: str | Path) -> str:
    """
    全文 OCR：逐页渲染为图片后识别，拼成多段文本（页间用换行分隔）。
    用于纯扫描 PDF 或整份无文本层文档。
    """
    import fitz  # PyMuPDF

    src = Path(path)
    if not src.is_file():
        raise FileNotFoundError(str(src))
    if _get_paddle_ocr() is None:
        return ""
    doc = fitz.open(str(src))
    parts: list[str] = []
    try:
        zoom = float(os.environ.get("OCR_PDF_RENDER_ZOOM", "2.0"))
        mat = fitz.Matrix(zoom, zoom)
        for i in range(doc.page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            png = pix.tobytes("png")
            text = ocr_image_bytes(png, suffix=".png")
            if text:
                parts.append(text)
    finally:
        doc.close()
    return "\n\n".join(parts).strip()
