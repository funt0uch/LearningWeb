from __future__ import annotations



from dataclasses import dataclass

from typing import Literal, Protocol, Sequence, Union





Role = Literal["system", "user", "assistant"]





@dataclass(frozen=True)

class ChatMessage:

    role: Role

    content: str





@dataclass(frozen=True)

class ChatRequest:

    messages: Sequence[ChatMessage]

    temperature: float = 0.2

    max_tokens: int | None = None





@dataclass(frozen=True)

class ChatResponse:

    content: str

    provider: str

    model: str

    raw: dict | None = None





# --- 多模态（文本 + 图片 URL，兼容 OpenAI / 方舟 chat.completions） ---





@dataclass(frozen=True)

class TextContentPart:

    type: Literal["text"] = "text"

    text: str = ""





@dataclass(frozen=True)

class ImageUrlContentPart:

    type: Literal["image_url"] = "image_url"

    url: str = ""  # https://... 或 data:image/png;base64,...





MultimodalPart = Union[TextContentPart, ImageUrlContentPart]





@dataclass(frozen=True)

class MultimodalChatRequest:

    system: str

    user_parts: Sequence[MultimodalPart]

    temperature: float = 0.2

    max_tokens: int | None = None





class LLMProvider(Protocol):

    """

    Provider 抽象：业务只能依赖该接口，禁止直接调用某个具体厂商 SDK/HTTP。

    """



    name: str



    async def chat(self, req: ChatRequest) -> ChatResponse: ...



    async def chat_multimodal(self, req: MultimodalChatRequest) -> ChatResponse:

        """图片 + 文本；默认实现不可用，具体 Provider 覆盖。"""

        raise NotImplementedError(f"{self.name} 未实现多模态 chat_multimodal")


