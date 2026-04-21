"""快速验证 LLM（需在 fastapi_env 中设置 ARK_API_KEY）。"""
import asyncio

from services.llm.base import ChatMessage, ChatRequest
from services.llm.router import get_llm


async def main() -> None:
    r = await get_llm().chat(
        ChatRequest(
            messages=[
                ChatMessage(role="user", content="你好，回复一个字：好"),
            ],
        ),
    )
    print(r.content)


if __name__ == "__main__":
    asyncio.run(main())
