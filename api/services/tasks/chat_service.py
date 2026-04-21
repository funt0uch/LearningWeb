"""通用学习助手对话（接入 LLMProvider）。"""

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
        "你是专业学习助教。用户会描述错题或困惑，请用中文：先简要归纳问题，再给出清晰步骤与易错点；"
        "语气友好、条理分明，避免空话。"
    ),
    "summarize": (
        "你是学习助教。用户描述题目或材料时，请用中文列出涉及的知识点（短句条目），"
        "必要时点出知识模块之间的关联。"
    ),
    "similar": (
        "你是出题助教。在用户给出一道题或知识点后，用中文再出 1～2 道练习：写出题面，"
        "再给参考答案要点（不必很长）。"
    ),
    "free": (
        "你是学习资料库中的 AI 助手。根据用户问题用中文作答，可解释概念、解题、总结或学习建议。"
    ),
}


async def tutor_chat(
    *,
    user_message: str,
    mode: str | None = None,
    image_urls: list[str] | None = None,
) -> str:
    m = (mode or "free").strip().lower()
    if m not in MODES:
        m = "free"
    system = SYSTEM.get(m, SYSTEM["free"])
    if os.environ.get("CHAT_INCLUDE_HISTORY") == "1":
        pass  # 预留多轮
    llm = get_llm()
    max_tokens = int(os.environ.get("CHAT_MAX_TOKENS", "2000"))

    imgs = [u.strip() for u in (image_urls or []) if (u or "").strip()]
    if imgs:
        parts = [TextContentPart(text=user_message), *[ImageUrlContentPart(url=u) for u in imgs]]
        resp = await llm.chat_multimodal(
            MultimodalChatRequest(
                system=system,
                user_parts=parts,
                temperature=0.35,
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
            temperature=0.35,
            max_tokens=max_tokens,
        )
    )
    return resp.content
