import asyncio
from pathlib import Path

from services.tasks.wrong_question_service import WrongQuestionService


async def main() -> None:
    p = Path(r"E:\LearningWeb\data\temp\samples\sample_pure_text.pdf")
    r = await WrongQuestionService().organize_from_pdf(path=str(p))
    print("items", len(r.items), "degraded", r.degraded, "vision", r.vision_used)
    print("saved", r.saved_path)


if __name__ == "__main__":
    asyncio.run(main())
