from __future__ import annotations

import mimetypes
import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

import fitz

from services.llm.base import ChatMessage, ChatRequest
from services.llm.router import get_llm
from services.tasks.parser_service import ParserService

ReportType = Literal["wrong", "knowledge"]

REPORT_TITLES: dict[ReportType, str] = {
    "wrong": "错题整理报告",
    "knowledge": "知识点总结报告",
}

REPORT_FOLDER_LABELS: dict[ReportType, str] = {
    "wrong": "错题整理",
    "knowledge": "知识点总结",
}

_MATH_TEXT_RULE = (
    "格式要求：内容会直接写入 PDF，不会经过 LaTeX 或 MathJax 渲染。"
    "所有数学公式必须写成普通中文讲义文本，禁止输出 $...$、\\(...\\)、\\[...\\]、"
    "\\frac、\\sqrt、\\int_、\\sum_ 等 LaTeX 源码。"
    "示例：写成“积分[-1,1] √(1-x²) dx = π/2”“f(x)=e^x-x+1/2”，"
    "不要写成 LaTeX。每个公式独立成短句，避免把多个公式挤在一行。"
)

_KNOWLEDGE_STRUCTURE_RULE = (
    "知识点总结必须采用以下结构，不要输出 Markdown 表格："
    "一、核心知识点概览；二、章节结构化提纲；三、重要公式清单；"
    "四、典型例题提示；五、复习优先级；六、一周复习计划。"
    "其中“三、重要公式清单”必须至少包含 12 条公式或方法，"
    "每条都按四行输出：名称：...；适用条件：...；公式：...；使用提醒：...。"
    "公式行必须单独成行；多个公式要拆成多行，不要横向挤在同一句里。"
    "复习优先级请用普通条目输出，禁止使用 Markdown 表格。"
)

_REPORT_PROMPTS: dict[ReportType, str] = {
    "wrong": (
        "你是面向大学课程复习的学习资料整理助手。请根据用户提供的 PDF 文本，"
        "整理成一份适合导出 PDF 的错题整理报告。必须包含："
        "1. 错题或易错题清单；2. 对应知识点；3. 关键解题思路；"
        "4. 常见错误原因；5. 复习建议；6. 可自测的相似练习。"
        "如果原文不是完整错题集，也要从内容中提炼容易出错的题型和知识点。"
        + _MATH_TEXT_RULE
    ),
    "knowledge": (
        "你是面向大学课程复习的学习资料整理助手。请根据用户提供的 PDF 文本，"
        "整理成一份适合导出 PDF 的知识点总结报告。必须包含："
        "1. 核心知识点概览；2. 章节结构化提纲；3. 重要定义、公式或方法；"
        "4. 典型例题提示；5. 复习优先级；6. 一周复习计划。"
        "内容要清晰、具体、可落地，避免空泛宣传。"
        + _KNOWLEDGE_STRUCTURE_RULE
        + _MATH_TEXT_RULE
    ),
}


@dataclass(frozen=True)
class GeneratedPdfReport:
    path: Path
    name: str
    size: int
    mime: str
    title: str
    report_type: ReportType


def _safe_stem(name: str) -> str:
    stem = Path(name).stem.strip() or "学习资料"
    return re.sub(r'[^0-9A-Za-z\u4e00-\u9fff\-\_\(\)\s]+', "_", stem)[:80]


def _extract_pdf_text(source_path: Path, limit_chars: int) -> str:
    parsed = ParserService().parse_pdf(path=str(source_path))
    chunks: list[str] = []
    for page in parsed.pages:
        text = (page.text or "").strip()
        if text:
            chunks.append(f"【第 {page.page} 页】\n{text}")
    joined = "\n\n".join(chunks).strip()
    if len(joined) > limit_chars:
        joined = joined[:limit_chars] + "\n\n（后续内容因篇幅限制已截断，请基于以上内容完成整理。）"
    return joined


def _plain_math(match: re.Match[str]) -> str:
    return _normalize_math_text(match.group(1) or "")


def _replace_latex_fractions(text: str) -> str:
    pattern = re.compile(r"\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}")
    previous = None
    while previous != text:
        previous = text
        text = pattern.sub(r"(\1)/(\2)", text)
    return text


def _replace_latex_roots(text: str) -> str:
    pattern = re.compile(r"\\sqrt\s*(?:\[([^{}\]]+)\])?\s*\{([^{}]+)\}")
    previous = None
    while previous != text:
        previous = text

        def repl(match: re.Match[str]) -> str:
            degree, value = match.group(1), match.group(2)
            return f"{degree}次根号({value})" if degree else f"√({value})"

        text = pattern.sub(repl, text)
    return text


def _replace_integrals(text: str) -> str:
    text = re.sub(r"\\int\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}", r"积分[\1,\2]", text)
    text = re.sub(r"\\int\s*_([^\s^{}]+)\s*\^([^\s{}]+)", r"积分[\1,\2]", text)
    return text.replace(r"\int", "积分")


def _replace_sums(text: str) -> str:
    text = re.sub(r"\\sum\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}", r"Σ[\1,\2]", text)
    text = re.sub(r"\\sum\s*_([^\s^{}]+)\s*\^([^\s{}]+)", r"Σ[\1,\2]", text)
    return text.replace(r"\sum", "Σ")


def _replace_superscripts(text: str) -> str:
    superscripts = str.maketrans("0123456789+-=()", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾")
    text = re.sub(
        r"\^(\d+)",
        lambda m: m.group(1).translate(superscripts),
        text,
    )
    text = re.sub(
        r"\^\{([0-9+\-=()]+)\}",
        lambda m: m.group(1).translate(superscripts),
        text,
    )
    return text


def _normalize_math_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text.strip())
    text = text.replace("\x00", "⇔")
    text = text.replace("∫", "积分")
    replacements = {
        r"\tan": "tan",
        r"\sin": "sin",
        r"\cos": "cos",
        r"\ln": "ln",
        r"\log": "log",
        r"\lim": "lim",
        r"\mathrm": "",
        r"\left": "",
        r"\right": "",
        r"\cdot": "·",
        r"\times": "×",
        r"\div": "÷",
        r"\sim": "~",
        r"\to": "→",
        r"\rightarrow": "→",
        r"\infty": "∞",
        r"\pi": "π",
        r"\theta": "θ",
        r"\alpha": "α",
        r"\beta": "β",
        r"\gamma": "γ",
        r"\Delta": "Δ",
        r"\geq": "≥",
        r"\ge": "≥",
        r"\leq": "≤",
        r"\le": "≤",
        r"\neq": "≠",
        r"\ne": "≠",
        r"\pm": "±",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    text = _replace_latex_fractions(text)
    text = _replace_latex_roots(text)
    text = _replace_integrals(text)
    text = _replace_sums(text)
    text = _replace_superscripts(text)
    text = re.sub(r"lim_\{([^{}]+)\}", r"lim(\1)", text)
    text = re.sub(r"lim_\(([^()]+)\)", r"lim(\1)", text)
    text = text.replace("{", "(").replace("}", ")")
    text = text.replace(r"\,", " ").replace(r"\;", " ").replace(r"\!", "")
    text = re.sub(r"\\([A-Za-z]+)", r"\1", text)
    text = text.replace("\\", "")
    text = _repair_plain_math_shorthand(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _repair_plain_math_shorthand(text: str) -> str:
    """Repair common model shortcuts in plain-text math without full equation parsing."""
    text = re.sub(r"\b(sec|csc|cot|tan|sin|cos)2(?=[A-Za-z(])", r"\1²", text)
    text = re.sub(r"(?<![A-Za-z0-9])([xytn])2(?=[\s,.;:，。；、)\]/+\-*=>≤≥]|$)", r"\1²", text)
    text = re.sub(r"(?<![A-Za-z0-9])([xytn])3(?=[\s,.;:，。；、)\]/+\-*=>≤≥]|$)", r"\1³", text)
    text = re.sub(r"([+\-*/=([{,，]\s*)([xytn])2(?=[A-Za-z+\-*/=),，。\s]|$)", r"\1\2²", text)
    text = re.sub(r"([+\-*/=([{,，]\s*)([xytn])3(?=[A-Za-z+\-*/=),，。\s]|$)", r"\1\2³", text)
    return text


def _looks_like_formula(text: str) -> bool:
    if any(token in text for token in ["=", "~", "→", "∞", "√", "π", "Δ", "积分", "lim", "dy/dx"]):
        return True
    return bool(re.search(r"\b(?:sin|cos|tan|ln|log|sec|csc|cot|e\^|x\^|f’|f')", text))


def _split_formula_list(text: str) -> list[str]:
    text = text.strip(" ，,;；")
    if not text:
        return []
    parts = re.split(r"[，,；;]\s*", text)
    if len(parts) <= 1:
        return [text]
    merged: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if _looks_like_formula(part) or len(part) <= 28:
            merged.append(part)
        elif merged:
            merged[-1] = f"{merged[-1]}，{part}"
        else:
            merged.append(part)
    return merged


def _expand_formula_lines(lines: list[str]) -> list[str]:
    expanded: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if "常用替换:" in stripped or "常用替换：" in stripped:
            prefix, formulas = re.split(r"常用替换[:：]", stripped, maxsplit=1)
            if prefix.strip():
                expanded.append(prefix.rstrip("，,。;；"))
            expanded.append("公式：")
            expanded.extend(f"= {item}" for item in _split_formula_list(formulas))
            continue

        if "公式为" in stripped:
            prefix, formulas = stripped.split("公式为", 1)
            if prefix.strip():
                expanded.append(prefix.rstrip("，,。;；"))
            expanded.append("公式：")
            expanded.extend(f"= {item}" for item in _split_formula_list(formulas))
            continue

        match = re.search(r"(公式[:：])(.+)", stripped)
        if match:
            before = stripped[: match.start()].strip()
            formulas = match.group(2).strip()
            if before:
                expanded.append(before.rstrip("，,。;；"))
            expanded.append("公式：")
            expanded.extend(f"= {item}" for item in _split_formula_list(formulas))
            continue

        expanded.append(stripped)
    return expanded


def _is_horizontal_rule(line: str) -> bool:
    compact = line.strip().replace(" ", "")
    return bool(compact) and set(compact) <= {"-", "_", "*", "—", "─"} and len(compact) >= 2


def _is_noise_line(line: str) -> bool:
    compact = line.strip().replace(" ", "")
    if compact in {"Day", "day"}:
        return True
    if compact in {"-", "—", "•", "·", "●", "▪", "--", "---"}:
        return True
    if re.fullmatch(r"\|?[:\-\s|]+\|?", line.strip()):
        return True
    return _is_horizontal_rule(line)


def _convert_markdown_table_line(line: str) -> str:
    stripped = line.strip()
    if not (stripped.startswith("|") and stripped.endswith("|")):
        return line
    cells = [cell.strip() for cell in stripped.strip("|").split("|")]
    cells = [cell for cell in cells if cell and not re.fullmatch(r"[:\-\s]+", cell)]
    if not cells:
        return ""
    return "；".join(cells)


def _normalize_label_colons(line: str) -> str:
    for label in ["名称", "适用条件", "公式", "使用提醒", "复习内容", "任务"]:
        line = re.sub(rf"^{label}\s*:", f"{label}：", line)
    return line


def _formula_density(lines: list[str]) -> int:
    return sum(1 for line in lines if _looks_like_formula(line))


def _high_math_formula_appendix(source_text: str) -> str:
    markers = ["高等数学", "极限", "导数", "积分", "洛必达", "无穷小"]
    if not any(marker in source_text for marker in markers):
        return ""
    return """
七、公式速查补充
名称：常用等价无穷小
适用条件：x→0，且用于乘除因子替换
公式：
= sin x ~ x
= tan x ~ x
= ln(1+x) ~ x
= e^x - 1 ~ x
= 1 - cos x ~ x²/2
使用提醒：加减项不能直接替换，必须先化成乘除结构。
名称：两个重要极限
适用条件：x→0 或 x→∞
公式：
= lim(x→0) sin x / x = 1
= lim(x→∞) (1+1/x)^x = e
= lim(x→0) (1+x)^(1/x) = e
使用提醒：幂指函数极限先整理成 1 加无穷小的形式。
名称：洛必达法则
适用条件：0/0 型或 ∞/∞ 型，分子分母在邻域可导
公式：
= lim f(x)/g(x) = lim f'(x)/g'(x)
使用提醒：每次使用前都要重新判断未定式类型。
名称：导数与微分
适用条件：函数在对应点可导
公式：
= f'(x0) = lim(Δx→0) [f(x0+Δx)-f(x0)] / Δx
= dy = f'(x) dx
使用提醒：可导必连续，连续不一定可导。
名称：参数方程求导
适用条件：x=x(t)，y=y(t)，且 x'(t)≠0
公式：
= dy/dx = y'(t) / x'(t)
使用提醒：二阶导数还要再除以 x'(t)。
名称：变上限积分求导
适用条件：f(x) 连续，上限函数可导
公式：
= d/dx 积分[a,x] f(t)dt = f(x)
= d/dx 积分[a,u(x)] f(t)dt = f(u(x))u'(x)
使用提醒：复合上限必须乘以上限函数的导数。
名称：分部积分法
适用条件：被积函数可以拆成 u 和 dv
公式：
= 积分 u dv = uv - 积分 v du
使用提醒：优先把对数函数、反三角函数、幂函数选作 u。
名称：对称区间奇偶积分
适用条件：区间为 [-a,a]
公式：
= 奇函数 f(x)：积分[-a,a] f(x)dx = 0
= 偶函数 f(x)：积分[-a,a] f(x)dx = 2积分[0,a] f(x)dx
使用提醒：先拆分被积函数，再分别判断奇偶性。
名称：反常积分 p 判别
适用条件：x=a 为瑕点，形式为 1/(x-a)^p
公式：
= 积分[a,b] 1/(x-a)^p dx：p<1 收敛，p≥1 发散
使用提醒：先找瑕点，再套 p 判别。
名称：定积分求面积
适用条件：两条曲线 y=f(x)，y=g(x) 围成区域
公式：
= 面积 = 积分[a,b] |f(x)-g(x)| dx
使用提醒：上下函数位置可能分段变化，必要时拆区间。
"""


def _fallback_knowledge_report(source_name: str, source_text: str, error: str) -> str:
    subject_hint = "高等数学" if _high_math_formula_appendix(source_text) else "课程资料"
    appendix = _high_math_formula_appendix(source_text)
    return f"""
{subject_hint}知识点总结报告
一、生成说明
本次在线模型响应超时，系统已生成本地兜底版知识点总结，保证资料整理结果可见、可下载、可继续复习。
来源资料：{source_name}
模型状态：{error}
二、核心知识点概览
1. 函数、极限与连续：重点关注无穷小、重要极限、洛必达法则、连续性和间断点。
2. 一元函数微分学：重点关注导数定义、求导法则、隐函数求导、参数方程求导、单调性、极值、凹凸性和拐点。
3. 一元函数积分学：重点关注不定积分、定积分、变上限积分、反常积分、面积和体积应用。
4. 证明专题：重点关注零点存在定理、单调性证明唯一性、构造函数证明不等式。
三、章节结构化提纲
第一章 函数、极限与连续
1. 无穷小量与等价无穷小
2. 极限计算与洛必达法则
3. 连续性与间断点分类
第二章 导数与微分
1. 导数定义与可导、连续关系
2. 复合函数、隐函数、参数方程求导
3. 导数应用：切线、单调性、极值、凹凸性、拐点
第三章 积分
1. 不定积分换元法与分部积分法
2. 定积分性质、奇偶性、周期性
3. 变上限积分、反常积分、几何应用
{appendix}
八、复习建议
1. 先把公式速查补充中的公式默写一遍，确认每条公式的适用条件。
2. 再按“极限、导数、积分、证明”四个模块各刷 5-10 道题。
3. 对做错的题继续点击“整理错题”，把薄弱知识点沉淀到错题库。
"""


def _normalize_report_body(body: str) -> str:
    body = unicodedata.normalize("NFKC", body)
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    body = re.sub(r"```(?:markdown|text)?", "", body, flags=re.I)
    body = body.replace("```", "")
    body = re.sub(r"\$\$([\s\S]*?)\$\$", _plain_math, body)
    body = re.sub(r"\$([^$\n]+)\$", _plain_math, body)
    body = re.sub(r"\\\(([\s\S]*?)\\\)", _plain_math, body)
    body = re.sub(r"\\\[([\s\S]*?)\\\]", _plain_math, body)
    normalized_lines = []
    for line in body.split("\n"):
        if _is_noise_line(line):
            continue
        normalized = _normalize_label_colons(_normalize_math_text(_convert_markdown_table_line(line)))
        if normalized and not _is_noise_line(normalized):
            normalized_lines.append(normalized)
    normalized_lines = _expand_formula_lines(normalized_lines)
    body = "\n".join(normalized_lines)
    body = re.sub(r"(?m)^\s*[-—]\s*", "• ", body)
    body = re.sub(r"(?m)^\s*\*\s+", "• ", body)
    body = re.sub(r"(?m)^[•\-—]\s*$\n?", "", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def _find_cjk_font() -> str | None:
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyh.ttf",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for item in candidates:
        if Path(item).is_file():
            return item
    return None


def _visual_width(text: str) -> int:
    width = 0
    for ch in text:
        width += 2 if unicodedata.east_asian_width(ch) in {"F", "W"} else 1
    return width


def _wrap_line(text: str, max_width: int) -> list[str]:
    text = text.rstrip()
    if not text:
        return [""]

    lines: list[str] = []
    current = ""
    current_width = 0
    for ch in text:
        ch_width = 2 if unicodedata.east_asian_width(ch) in {"F", "W"} else 1
        should_break = current_width + ch_width > max_width
        if should_break and current:
            lines.append(current.rstrip())
            current = ""
            current_width = 0
        current += ch
        current_width += ch_width
        if ch in "。！？；;" and current_width > max_width * 0.55:
            lines.append(current.rstrip())
            current = ""
            current_width = 0
    if current:
        lines.append(current.rstrip())
    return lines


def _line_kind(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return "blank"
    if stripped.startswith("= "):
        return "formula"
    if stripped in {"公式：", "公式:"}:
        return "formula_label"
    if stripped.startswith(("名称：", "名称:", "适用条件：", "适用条件:", "使用提醒：", "使用提醒:")):
        return "formula_meta"
    if stripped.startswith("#"):
        return "heading"
    if re.match(r"^[一二三四五六七八九十]+[、.．]", stripped):
        return "heading"
    if (
        "：" not in stripped
        and ":" not in stripped
        and len(stripped) <= 28
        and re.match(r"^\d+[.．、]\s*(核心|章节|重要|典型|复习|一周)", stripped)
    ):
        return "heading"
    if re.match(r"^第[一二三四五六七八九十]+章\s*", stripped):
        return "subheading"
    if len(stripped) <= 12 and re.match(r"^[\u4e00-\u9fffA-Za-z]+类$", stripped):
        return "subheading"
    if stripped.startswith(("• ", "- ")):
        return "bullet"
    return "body"


def _clean_line(text: str, kind: str) -> str:
    text = text.strip()
    if kind in {"heading", "subheading"}:
        return text.lstrip("#").strip()
    if kind == "bullet":
        return re.sub(r"^(?:•|-)\s*", "", text).strip()
    if kind == "formula":
        return text[2:].strip()
    return text


def _new_page(doc: fitz.Document, width: float, height: float) -> fitz.Page:
    page = doc.new_page(width=width, height=height)
    page.draw_rect(
        fitz.Rect(0, 0, width, height),
        color=None,
        fill=(1, 1, 1),
    )
    return page


def _render_pdf(*, title: str, body: str, output_path: Path, source_name: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    font_file = _find_cjk_font()
    font_kwargs = {"fontname": "helv"}
    if font_file:
        font_kwargs = {"fontname": "cjk", "fontfile": font_file}

    doc = fitz.open()
    width, height = fitz.paper_size("a4")
    margin_x = 64
    margin_top = 58
    margin_bottom = 56
    body_size = 11
    line_height = 18

    page = _new_page(doc, width, height)
    y = margin_top

    page.insert_text((margin_x, y), title, fontsize=21, color=(0.02, 0.18, 0.32), **font_kwargs)
    y += 34
    meta = f"来源文件：{source_name}    生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}"
    page.insert_text((margin_x, y), meta, fontsize=9, color=(0.36, 0.45, 0.53), **font_kwargs)
    y += 26
    page.draw_line((margin_x, y), (width - margin_x, y), color=(0.48, 0.74, 0.73), width=0.9)
    y += 22

    for raw in body.split("\n"):
        kind = _line_kind(raw)
        text = _clean_line(raw, kind)

        if kind == "blank":
            y += 8
            continue

        if kind == "heading":
            font_size = 15
            color = (0.02, 0.22, 0.39)
            max_width = 44
            y += 4
            indent = 0
        elif kind == "subheading":
            font_size = 12.5
            color = (0.06, 0.26, 0.42)
            max_width = 50
            y += 2
            indent = 0
        elif kind == "bullet":
            font_size = body_size
            color = (0.10, 0.14, 0.18)
            max_width = 54
            indent = 18
        elif kind == "formula_label":
            font_size = 11
            color = (0.02, 0.22, 0.39)
            max_width = 54
            y += 2
            indent = 0
        elif kind == "formula":
            font_size = 10.5
            color = (0.06, 0.16, 0.24)
            max_width = 50
            indent = 18
        elif kind == "formula_meta":
            font_size = 10.5
            color = (0.15, 0.19, 0.24)
            max_width = 56
            indent = 0
        else:
            font_size = body_size
            color = (0.10, 0.14, 0.18)
            max_width = 58
            indent = 0

        lines = _wrap_line(text, max_width)
        for index, line in enumerate(lines):
            if y > height - margin_bottom:
                page = _new_page(doc, width, height)
                y = margin_top
            x = margin_x + indent
            content = line
            if kind == "bullet" and index == 0:
                page.insert_text((margin_x, y), "•", fontsize=font_size, color=(0.04, 0.46, 0.48), **font_kwargs)
            if kind == "formula" and index == 0:
                rect = fitz.Rect(margin_x + 10, y - 12, width - margin_x, y + line_height - 3)
                page.draw_rect(rect, color=(0.83, 0.90, 0.92), fill=(0.965, 0.985, 0.985), width=0.45)
                page.insert_text((margin_x + 15, y), "=", fontsize=font_size, color=(0.04, 0.46, 0.48), **font_kwargs)
                x = margin_x + 30
            page.insert_text((x, y), content, fontsize=font_size, color=color, **font_kwargs)
            y += line_height + (2 if kind in {"heading", "subheading", "formula"} else 0)
        if kind in {"heading", "subheading"}:
            y += 5

    doc.save(str(output_path), garbage=4, deflate=True)
    doc.close()


def _unique_report_path(folder_dir: Path, source_name: str, report_type: ReportType) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    stem = _safe_stem(source_name)
    base = f"{stem}-{REPORT_TITLES[report_type]}-{stamp}.pdf"
    candidate = folder_dir / base
    index = 2
    while candidate.exists():
        candidate = folder_dir / f"{stem}-{REPORT_TITLES[report_type]}-{stamp}-{index}.pdf"
        index += 1
    return candidate


async def generate_pdf_report(
    *,
    source_path: Path,
    target_dir: Path,
    report_type: ReportType,
) -> GeneratedPdfReport:
    text = _extract_pdf_text(source_path, int(os.getenv("PDF_REPORT_CONTEXT_CHARS", "9000")))
    if not text:
        raise ValueError("PDF 未解析到可用于整理的文本内容")

    title = REPORT_TITLES[report_type]
    prompt = _REPORT_PROMPTS[report_type]
    llm = get_llm()
    try:
        response = await llm.chat(
            ChatRequest(
                messages=[
                    ChatMessage(role="system", content=prompt),
                    ChatMessage(
                        role="user",
                        content=(
                            f"资料名称：{source_path.name}\n\n"
                            f"请输出《{title}》，使用中文小标题和要点。"
                            "内容要具体，适合直接放入学习资料库。"
                            "再次强调：公式必须写成普通文本，不要使用 LaTeX 或 Markdown 数学语法。"
                            "如果涉及高等数学公式，请优先写成“条件 + 公式 + 使用提醒”的短句。\n\n"
                            f"{text}"
                        ),
                    ),
                ],
                temperature=0.15,
                max_tokens=3600,
            )
        )
        raw_body = response.content.strip()
    except RuntimeError as exc:
        if report_type != "knowledge":
            raise
        raw_body = _fallback_knowledge_report(source_path.name, text, str(exc))

    output_path = _unique_report_path(target_dir, source_path.name, report_type)
    body = _normalize_report_body(raw_body)
    if report_type == "knowledge":
        body_lines = body.split("\n")
        if _formula_density(body_lines) < 18:
            appendix = _normalize_report_body(_high_math_formula_appendix(text))
            if appendix:
                body = f"{body}\n\n{appendix}"
    _render_pdf(title=title, body=body, output_path=output_path, source_name=source_path.name)
    mime = mimetypes.guess_type(output_path.name)[0] or "application/pdf"
    return GeneratedPdfReport(
        path=output_path,
        name=output_path.name,
        size=output_path.stat().st_size,
        mime=mime,
        title=title,
        report_type=report_type,
    )
