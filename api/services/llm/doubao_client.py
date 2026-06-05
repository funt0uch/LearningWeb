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
    """Volcengine Ark / Doubao provider using the OpenAI-compatible API."""

    name = "doubao"

    def __init__(self) -> None:
        self.base_url = (
            os.getenv("DOUBAO_BASE_URL", "").strip()
            or "https://ark.cn-beijing.volces.com/api/v3"
        ).rstrip("/")
        self.api_key = (
            os.getenv("ARK_API_KEY", "").strip()
            or os.getenv("DOUBAO_API_KEY", "").strip()
        )
        self.model = os.getenv("DOUBAO_MODEL", "doubao-seed-2-0-pro-260215").strip()
        self.timeout_s = float(os.getenv("DOUBAO_TIMEOUT_S", "30").strip() or "30")

    def _assert_config(self) -> None:
        if not self.api_key:
            raise RuntimeError("未配置 API Key：请设置环境变量 ARK_API_KEY 或 DOUBAO_API_KEY")

    async def chat(self, req: ChatRequest) -> ChatResponse:
        self._assert_config()

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": msg.role, "content": msg.content} for msg in req.messages],
            "temperature": req.temperature,
        }
        if req.max_tokens is not None:
            payload["max_tokens"] = req.max_tokens

        data = await self._post_chat_completions(payload, timeout_s=self.timeout_s)
        content = self._extract_content(data)
        return ChatResponse(content=content, provider=self.name, model=self.model, raw=data)

    async def chat_multimodal(self, req: MultimodalChatRequest) -> ChatResponse:
        self._assert_config()

        user_content: list[dict[str, Any]] = []
        for part in req.user_parts:
            if isinstance(part, TextContentPart):
                user_content.append({"type": "text", "text": part.text})
            elif isinstance(part, ImageUrlContentPart):
                user_content.append({"type": "image_url", "image_url": {"url": part.url}})

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

        data = await self._post_chat_completions(payload, timeout_s=max(self.timeout_s, 45.0))
        content = self._extract_content(data)
        return ChatResponse(content=content, provider=self.name, model=self.model, raw=data)

    async def _post_chat_completions(
        self,
        payload: dict[str, Any],
        *,
        timeout_s: float,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException as exc:
            raise RuntimeError(
                f"LLM 请求超时（>{timeout_s:.0f}s）：请检查网络、代理或 DOUBAO_BASE_URL"
            ) from exc
        except httpx.HTTPStatusError as exc:
            text = (exc.response.text or "").strip()
            if len(text) > 500:
                text = text[:500] + "..."
            raise RuntimeError(
                f"LLM 调用失败：HTTP {exc.response.status_code} {text}".strip()
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"LLM 调用异常：{exc}") from exc

    @staticmethod
    def _extract_content(data: dict[str, Any]) -> str:
        try:
            content = data["choices"][0]["message"]["content"]
        except Exception:
            return str(data)
        if isinstance(content, list):
            return "\n".join(
                str(item.get("text", item)) if isinstance(item, dict) else str(item)
                for item in content
            )
        return str(content)
