from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

from services.llm.base import ChatMessage, ChatRequest
from services.llm.router import get_llm


Difficulty = Literal["easy", "medium", "hard"]


@dataclass(frozen=True)
class ExamQuestion:
    prompt: str
    answer: str | None
    analysis: str | None
    tags: dict


@dataclass(frozen=True)
class ExamPaper:
    title: str
    difficulty: Difficulty
    questions: Sequence[ExamQuestion]
    meta: dict


class ExamGeneratorService:
    """
    试卷生成任务编排层：
    - prompt 构造（按知识点/难度/数量）
    - 结构化输出（后续做 JSON 校验与重试）

    重要：controller 禁止直接调用 llm；必须通过本服务（task 层）进入。
    """

    async def generate_from_topics(
        self,
        *,
        subject: str,
        topics: Sequence[str],
        difficulty: Difficulty = "medium",
        question_count: int = 10,
    ) -> ExamPaper:
        llm = get_llm()

        system = (
            "你是出题老师，面向学生生成练习试卷。"
            "要求题目清晰、答案可核对、并给出必要解析。"
            "输出必须是严格 JSON，不要输出多余文字。"
        )

        user = (
            f"学科：{subject}\n"
            f"知识点：{', '.join(topics)}\n"
            f"难度：{difficulty}\n"
            f"题量：{question_count}\n\n"
            "【JSON Schema（必须严格满足）】\n"
            "{\n"
            "  \"title\": string,\n"
            "  \"difficulty\": \"easy\"|\"medium\"|\"hard\",\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"prompt\": string,\n"
            "      \"answer\": string|null,\n"
            "      \"analysis\": string|null,\n"
            "      \"tags\": object\n"
            "    }\n"
            "  ],\n"
            "  \"meta\": object\n"
            "}\n"
        )

        resp = await llm.chat(
            ChatRequest(
                messages=[
                    ChatMessage(role="system", content=system),
                    ChatMessage(role="user", content=user),
                ],
                temperature=0.4,
                max_tokens=1800,
            )
        )

        # 占位：第四阶段加 JSON 解析/校验/重试；当前先返回透传结构占位
        return ExamPaper(
            title=f"{subject} 试卷（占位）",
            difficulty=difficulty,
            questions=(),
            meta={"raw": resp.content},
        )

