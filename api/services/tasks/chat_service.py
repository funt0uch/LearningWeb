"""通用学习助手对话服务。"""

from __future__ import annotations

import os

from services.llm.base import (
    ChatMessage,
    ChatRequest,
    ImageUrlContentPart,
    MultimodalChatRequest,
    TextContentPart,
)
from services.llm.router import get_llm

MODES = ("explain", "summarize", "similar", "free")

SYSTEM = {
    "explain": (
        "你是 LearningWeb 的错题讲解老师。请始终用中文回答，结构固定为："
        "1. 结论；2. 解题思路；3. 易错点；4. 复习建议。"
        "不要泛泛而谈，不要输出过长背景介绍，优先帮助学生理解为什么错。"
    ),
    "summarize": (
        "你是 LearningWeb 的资料整理助手。请用中文把资料内容整理为："
        "核心知识点、知识点关系、需要复习的薄弱点。"
        "输出要条理清楚，适合学生直接放进复习笔记。"
    ),
    "similar": (
        "你是 LearningWeb 的出题老师。请根据用户给出的题目或知识点，生成 1 到 2 道相似练习。"
        "每道题包含：题目、考查知识点、参考答案、简要解析。"
    ),
    "free": (
        "你是 LearningWeb AI 智慧学习闭环平台中的学习助手。"
        "请用中文回答，默认面向大学生学习场景。"
        "回答应简洁、可执行，优先围绕资料管理、错题解析、知识点总结和复习计划。"
        "如果用户只是测试连通性，请直接给出简短确认，不要展开解释 API 等无关概念。"
    ),
}


async def tutor_chat(
    *,
    user_message: str,
    mode: str | None = None,
    image_urls: list[str] | None = None,
) -> str:
    current_mode = (mode or "free").strip().lower()
    if current_mode not in MODES:
        current_mode = "free"

    system = SYSTEM.get(current_mode, SYSTEM["free"])
    if os.environ.get("CHAT_INCLUDE_HISTORY") == "1":
        pass

    llm = get_llm()
    max_tokens = int(os.environ.get("CHAT_MAX_TOKENS", "1200"))
    images = [url.strip() for url in (image_urls or []) if (url or "").strip()]

    if images:
        parts = [
            TextContentPart(text=user_message),
            *[ImageUrlContentPart(url=url) for url in images],
        ]
        resp = await llm.chat_multimodal(
            MultimodalChatRequest(
                system=system,
                user_parts=parts,
                temperature=0.3,
                max_tokens=max_tokens,
            )
        )
        return resp.content

    resp = await llm.chat(
        ChatRequest(
            messages=[
                ChatMessage(role="system", content=system),
                ChatMessage(role="user", content=user_message),
            ],
            temperature=0.3,
            max_tokens=max_tokens,
        )
    )
    return resp.content
