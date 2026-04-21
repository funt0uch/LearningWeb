from __future__ import annotations

import os
from functools import lru_cache

from .base import LLMProvider
from .doubao_client import DoubaoProvider


@lru_cache(maxsize=1)
def get_llm() -> LLMProvider:
    """
    统一 LLM Service Layer 入口。

    - 默认：豆包（火山引擎）
    - 后续：DeepSeek / 通义 只需要新增 provider 实现，并在此处切换即可

    业务代码必须只 import 这里：

        from services.llm.router import get_llm
        llm = get_llm()
        resp = await llm.chat(...)
    """

    provider = os.getenv("LLM_PROVIDER", "doubao").strip().lower()

    if provider == "doubao":
        return DoubaoProvider()

    if provider in ("deepseek", "qwen", "tongyi"):
        raise NotImplementedError(f"LLM_PROVIDER={provider} 尚未接入")

    raise ValueError(f"未知 LLM_PROVIDER: {provider}")

