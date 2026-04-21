from __future__ import annotations

import os
from typing import Any

import httpx

from .base import (
    ChatRequest,
    ChatResponse,
    ImageUrlContentPart,
    LLMProvider,
    MultimodalChatRequest,
    TextContentPart,
)


class DoubaoProvider(LLMProvider):
    """
    豆包（火山引擎）Provider 实现。

    注意：这里是“实现层”，业务代码禁止 import 这个类。
    业务应通过 services/llm/router.py 里的 get_llm() 获取统一 Provider。
    """

    name = "doubao"

    def __init__(self) -> None:
        # 火山方舟 OpenAI 兼容接口：https://www.volcengine.com/docs/82379/1399008
        self.base_url = (
            os.getenv("DOUBAO_BASE_URL", "").strip()
            or "https://ark.cn-beijing.volces.com/api/v3"
        ).rstrip("/")
        # 与官方文档一致：可用环境变量注入，勿把 Key 写进代码或聊天里
        self.api_key = (
            os.getenv("ARK_API_KEY", "").strip()
            or os.getenv("DOUBAO_API_KEY", "").strip()
        )
        self.model = os.getenv("DOUBAO_MODEL", "doubao-seed-2-0-pro-260215").strip()
        self.timeout_s = float(os.getenv("DOUBAO_TIMEOUT_S", "30").strip() or "30")

    def _assert_config(self) -> None:
        if not self.api_key:
            raise RuntimeError(
                "未配置 API Key：请设置环境变量 ARK_API_KEY（推荐）或 DOUBAO_API_KEY"
            )

    async def chat(self, req: ChatRequest) -> ChatResponse:
        """
        统一 Chat 入口。

        这里用 httpx 做 HTTP 调用占位；后续无论豆包是 OpenAI 兼容还是自定义协议，
        都只改本文件，不动业务层。
        """
        self._assert_config()

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in req.messages],
            "temperature": req.temperature,
        }
        if req.max_tokens is not None:
            payload["max_tokens"] = req.max_tokens

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                r = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                r.raise_for_status()
                data = r.json()
        except httpx.TimeoutException as e:
            raise RuntimeError(f"LLM 请求超时（>{self.timeout_s:.0f}s）：请检查网络/代理或 DOUBAO_BASE_URL") from e
        except httpx.HTTPStatusError as e:
            txt = ""
            try:
                txt = e.response.text
            except Exception:
                txt = ""
            txt = (txt or "").strip()
            if len(txt) > 500:
                txt = txt[:500] + "…"
            raise RuntimeError(
                f"LLM 调用失败：HTTP {e.response.status_code} {txt}".strip()
            ) from e
        except Exception as e:
            raise RuntimeError(f"LLM 调用异常：{e}") from e

        # 兼容 OpenAI 风格返回（占位）
        content = ""
        try:
            content = data["choices"][0]["message"]["content"]
        except Exception:
            content = str(data)

        return ChatResponse(content=content, provider=self.name, model=self.model, raw=data)

    async def chat_multimodal(self, req: MultimodalChatRequest) -> ChatResponse:
        """方舟 OpenAI 兼容：user.content 为 [{type,text},{type,image_url}] 列表。"""
        self._assert_config()

        user_content: list[dict[str, Any]] = []
        for p in req.user_parts:
            if isinstance(p, TextContentPart):
                user_content.append({"type": "text", "text": p.text})
            elif isinstance(p, ImageUrlContentPart):
                user_content.append(
                    {"type": "image_url", "image_url": {"url": p.url}},
                )

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": req.system},
                {"role": "user", "content": user_content},
            ],
            "temperature": req.temperature,
        }
        if req.max_tokens is not None:
            payload["max_tokens"] = req.max_tokens

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=max(self.timeout_s, 45.0)) as client:
                r = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                r.raise_for_status()
                data = r.json()
        except httpx.TimeoutException as e:
            raise RuntimeError(
                f"LLM 多模态请求超时（>{max(self.timeout_s,45.0):.0f}s）：请检查网络/代理或 DOUBAO_BASE_URL"
            ) from e
        except httpx.HTTPStatusError as e:
            txt = ""
            try:
                txt = e.response.text
            except Exception:
                txt = ""
            txt = (txt or "").strip()
            if len(txt) > 500:
                txt = txt[:500] + "…"
            raise RuntimeError(
                f"LLM 多模态调用失败：HTTP {e.response.status_code} {txt}".strip()
            ) from e
        except Exception as e:
            raise RuntimeError(f"LLM 多模态调用异常：{e}") from e

        content = ""
        try:
            content = data["choices"][0]["message"]["content"]
        except Exception:
            content = str(data)

        return ChatResponse(content=content, provider=self.name, model=self.model, raw=data)

