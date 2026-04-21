"""错题整理输出 JSON Schema（Pydantic 严格校验）。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class WrongQuestionItemSchema(BaseModel):
    question: str = Field(..., min_length=1, description="题干")
    answer: str = Field(default="", description="答案或参考答案")
    knowledge_point: str = Field(..., min_length=1, description="知识点")
    analysis: str = Field(..., min_length=1, description="解析")
    difficulty: Literal["easy", "medium", "hard"]
    source_page: int = Field(..., ge=1, description="来源页码")
    related_image_paths: list[str] = Field(
        default_factory=list,
        description="关联页面图片本地路径（多模态识别时填入）",
    )
    item_id: str = Field(default="", description="服务端生成的稳定 id（LLM 可不填）")


class WrongQuestionOutputSchema(BaseModel):
    schema_version: Literal[1] = 1
    summary: str = Field(..., min_length=0)
    items: list[WrongQuestionItemSchema] = Field(default_factory=list)
