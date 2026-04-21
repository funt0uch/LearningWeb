"""
生成 3 类 PDF 联调样例到 E:\\LearningWeb\\data\\temp\\samples\\
- pure_text：可选中文字体行文本
- scan_like：小字号、浅灰，模拟扫描卷排版
- with_image：嵌入简单几何示意图（png）

每种含 ≥5 道题干，供错题整理 / 多模态测试。
"""

from __future__ import annotations

from pathlib import Path

import fitz

OUT = Path(r"E:\LearningWeb\data\temp\samples")
OUT.mkdir(parents=True, exist_ok=True)
WIN_FONT = Path(r"C:\Windows\Fonts\msyh.ttc")
if not WIN_FONT.is_file():
    WIN_FONT = Path(r"C:\Windows\Fonts\simhei.ttf")


def _ensure_cjk_font(page: fitz.Page) -> str:
    if not WIN_FONT.is_file():
        return "helv"
    page.insert_font(fontname="jk", fontfile=str(WIN_FONT))
    return "jk"


def _write_lines_fixed(page: fitz.Page, x: float, y: float, lines: list[str], size: float = 12, gray=(0, 0, 0)) -> None:
    fn = _ensure_cjk_font(page)
    yy = y
    for line in lines:
        page.insert_text((x, yy), line, fontname=fn, fontsize=size, color=gray)
        yy += size * 1.35


def _tiny_png() -> bytes:
    """简单三角示意图 200x120 PNG。"""
    doc = fitz.open()
    page = doc.new_page(width=200, height=120)
    shape = page.new_shape()
    shape.draw_line(fitz.Point(20, 90), fitz.Point(180, 90))
    shape.draw_line(fitz.Point(20, 90), fitz.Point(100, 20))
    shape.draw_line(fitz.Point(100, 20), fitz.Point(180, 90))
    shape.finish(color=(0.2, 0.3, 0.8), width=1.2)
    shape.commit()
    pix = page.get_pixmap(alpha=False)
    data = pix.tobytes("png")
    doc.close()
    return data


def make_pure_text() -> Path:
    doc = fitz.open()
    page = doc.new_page()
    title = "纯文本 PDF 样例 · 错题整理测试"
    lines = [
        title,
        "",
        "1. 求极限：当 x 趋于 0 时，sin(x)/x 的值是多少？",
        "2. 设 f(x)=x^2+3x，求 f'(x)。",
        "3. 矩阵 A=[[1,2],[3,4]]，求行列式 det(A)。",
        "4. 写出定积分 ∫_0^1 x dx 的结果。",
        "5. 解释函数可导与连续之间的关系。",
    ]
    _write_lines_fixed(page, 72, 72, lines, size=12)
    path = OUT / "sample_pure_text.pdf"
    doc.save(str(path))
    doc.close()
    return path


def make_scan_like() -> Path:
    doc = fitz.open()
    page = doc.new_page()
    gray = (0.35, 0.35, 0.35)
    lines = [
        "模拟扫描试卷（浅灰排版）",
        "",
        "1. 计算：(2+3)*4",
        "2. 因式分解：x^2-1",
        "3. 求和：1+2+...+100",
        "4. 解方程：2x+1=7",
        "5. 已知直角边 3 与 4，求斜边长度",
    ]
    _write_lines_fixed(page, 60, 60, lines, size=10.5, gray=gray)
    path = OUT / "sample_scan_like.pdf"
    doc.save(str(path))
    doc.close()
    return path


def make_with_image() -> Path:
    doc = fitz.open()
    page = doc.new_page()
    fn = _ensure_cjk_font(page)
    if fn == "jk":
        page.insert_text((72, 48), "含图题目样例（几何图 + 文字）", fontname=fn, fontsize=14)
        page.insert_text(
            (72, 80),
            "1. 如图，求三角形某边长（请结合示意图作答）。",
            fontname=fn,
            fontsize=12,
        )
        page.insert_text((72, 110), "2. 圆的周长公式是？", fontname=fn, fontsize=12)
        page.insert_text((72, 140), "3. 写出勾股定理表达式。", fontname=fn, fontsize=12)
        page.insert_text((72, 170), "4. 求 12 与 18 的最大公约数。", fontname=fn, fontsize=12)
        page.insert_text((72, 200), "5. 将 0.25 写成分数。", fontname=fn, fontsize=12)
    else:
        page.insert_text((72, 48), "Image sample (no CJK font)", fontname="helv", fontsize=14)
        page.insert_text((72, 80), "1. See triangle diagram.", fontname="helv", fontsize=12)
        page.insert_text((72, 110), "2. Circle perimeter formula?", fontname="helv", fontsize=12)
        page.insert_text((72, 140), "3. Pythagorean theorem?", fontname="helv", fontsize=12)
        page.insert_text((72, 170), "4. GCD 12 and 18?", fontname="helv", fontsize=12)
        page.insert_text((72, 200), "5. 0.25 as fraction?", fontname="helv", fontsize=12)
    img = _tiny_png()
    rect = fitz.Rect(320, 72, 520, 192)
    page.insert_image(rect, stream=img)
    path = OUT / "sample_with_image.pdf"
    doc.save(str(path))
    doc.close()
    return path


def main() -> None:
    p1 = make_pure_text()
    p2 = make_scan_like()
    p3 = make_with_image()
    print("written:", p1, p2, p3, sep="\n")


if __name__ == "__main__":
    main()
