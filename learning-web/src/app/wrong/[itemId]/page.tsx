"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { BookOpenCheck, Brain, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { getWrongItem, postChat } from "@/lib/filesApi";
import { postPracticeGenerate, postPracticeSubmit } from "@/lib/learningApi";
import { recordStudyEvent } from "@/lib/studyApi";
import type { WrongItemDetailResponse } from "@/types/folder";

function difficultyZh(difficulty: string): string {
  if (difficulty === "easy") return "容易";
  if (difficulty === "hard") return "困难";
  return "中等";
}

export default function WrongQuestionDetailPage() {
  const params = useParams();
  const itemId = typeof params?.itemId === "string" ? params.itemId : "";
  const [data, setData] = useState<WrongItemDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [similarText, setSimilarText] = useState<string | null>(null);
  const [similarBusy, setSimilarBusy] = useState(false);
  const [practiceStem, setPracticeStem] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceEval, setPracticeEval] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await getWrongItem(itemId);
        if (!cancelled) {
          setData(result);
          setError(null);
          void recordStudyEvent({ action: "view", itemId }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const loadSimilar = useCallback(async () => {
    const item = data?.item;
    if (!item?.question) return;

    setSimilarBusy(true);
    setSimilarText(null);
    try {
      const result = await postChat({
        message: `下面是一道错题，请基于相同知识点再出 1 到 2 道相似练习题，并附参考答案要点。\n\n【题干】${item.question}\n【知识点】${item.knowledge_point}`,
        mode: "similar",
      });
      setSimilarText(result.reply);
    } catch (err) {
      setSimilarText(err instanceof Error ? err.message : "生成失败");
    } finally {
      setSimilarBusy(false);
    }
  }, [data]);

  const startPractice = useCallback(async () => {
    if (!itemId) return;

    setPracticeBusy(true);
    setPracticeEval(null);
    try {
      const result = await postPracticeGenerate(itemId);
      setPracticeId(result.practice_id);
      setPracticeStem(result.stem);
      void recordStudyEvent({
        action: "practice_start",
        itemId,
        meta: { practice_id: result.practice_id },
      }).catch(() => {});
    } catch (err) {
      setPracticeStem(err instanceof Error ? err.message : "生成失败");
      setPracticeId(null);
    } finally {
      setPracticeBusy(false);
    }
  }, [itemId]);

  const submitPractice = useCallback(async () => {
    if (!practiceId || !practiceAnswer.trim()) return;

    setPracticeBusy(true);
    try {
      const result = await postPracticeSubmit(practiceId, practiceAnswer);
      setPracticeEval(
        `得分：${result.score ?? "-"} · ${result.verdict}\n${result.feedback}`,
      );
      void recordStudyEvent({
        action: "practice_submit",
        itemId: itemId || undefined,
        meta: { practice_id: practiceId, score: result.score },
      }).catch(() => {});
    } catch (err) {
      setPracticeEval(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPracticeBusy(false);
    }
  }, [practiceId, practiceAnswer, itemId]);

  const item = data?.item;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef6fb_100%)] text-[var(--main-fg)]">
      <TopNav title="错题详情" />
      <main className="mx-auto max-w-5xl px-6 py-8">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </div>
        ) : null}

        {!item && !error ? (
          <div className="rounded-lg border border-white/70 bg-white/80 p-8 text-[14px] text-slate-500 shadow-[var(--shadow-card)]">
            正在加载错题...
          </div>
        ) : null}

        {item ? (
          <article className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-5">
              <Panel
                icon={<BookOpenCheck className="h-5 w-5" />}
                title={`题目 · 第 ${item.source_page} 页 · ${difficultyZh(item.difficulty)}`}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-8 text-[#10213f]">
                  {item.question}
                </p>
              </Panel>

              <Panel title="答案">
                <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-600">
                  {item.answer || "-"}
                </p>
              </Panel>

              <Panel icon={<Brain className="h-5 w-5" />} title="AI 解析">
                <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-700">
                  {item.analysis}
                </p>
              </Panel>

              <Panel title="知识点">
                <span className="inline-flex rounded-full border border-[#b8e4e8] bg-[#e9fbfc] px-3 py-1 text-[13px] font-semibold text-[#0f8f99]">
                  {item.knowledge_point}
                </span>
              </Panel>

              {item.related_image_paths?.length ? (
                <Panel icon={<ImageIcon className="h-5 w-5" />} title="关联图片路径">
                  <ul className="list-inside list-disc break-all text-[12px] leading-6 text-slate-500">
                    {item.related_image_paths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </section>

            <aside className="space-y-5">
              <Panel icon={<Sparkles className="h-5 w-5" />} title="错题再练">
                <p className="text-[13px] leading-6 text-slate-500">
                  基于当前错题生成结构化练习题，提交后由 AI 给出简要批改反馈。
                </p>
                <button
                  type="button"
                  disabled={practiceBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0f9ca8] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(15,156,168,0.22)] transition hover:bg-[#0b8792] disabled:opacity-50"
                  onClick={() => void startPractice()}
                >
                  {practiceBusy && !practiceStem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {practiceBusy && !practiceStem ? "正在生成..." : "生成同类练习题"}
                </button>

                {practiceStem ? (
                  <div className="mt-4 space-y-3">
                    <p className="whitespace-pre-wrap rounded-lg bg-[#f3f8fb] px-3 py-3 text-[13px] leading-7 text-[#10213f]">
                      {practiceStem}
                    </p>
                    <textarea
                      className="min-h-[112px] w-full rounded-lg border border-[#d6e5ee] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[#0f9ca8] focus:ring-2 focus:ring-[#0f9ca8]/10"
                      placeholder="在这里写下你的解答..."
                      value={practiceAnswer}
                      onChange={(event) => setPracticeAnswer(event.target.value)}
                    />
                    <button
                      type="button"
                      disabled={practiceBusy || !practiceAnswer.trim()}
                      className="rounded-lg bg-[#10213f] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1a3159] disabled:opacity-40"
                      onClick={() => void submitPractice()}
                    >
                      提交批改
                    </button>
                    {practiceEval ? (
                      <p className="whitespace-pre-wrap rounded-lg border border-[#d6e5ee] bg-white px-3 py-3 text-[13px] leading-7 text-slate-700">
                        {practiceEval}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Panel>

              <Panel title="相似题推荐">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] leading-6 text-slate-500">
                    让 AI 根据当前知识点生成举一反三练习，用于课后复盘。
                  </p>
                  <button
                    type="button"
                    disabled={similarBusy}
                    className="shrink-0 rounded-lg bg-[#0f9ca8] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0b8792] disabled:opacity-50"
                    onClick={() => void loadSimilar()}
                  >
                    {similarBusy ? "生成中..." : "AI 生成"}
                  </button>
                </div>
                {similarText ? (
                  <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[#f3f8fb] px-3 py-3 text-[13px] leading-7 text-slate-700">
                    {similarText}
                  </p>
                ) : null}
              </Panel>
            </aside>
          </article>
        ) : null}
      </main>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/70 bg-white/86 p-5 shadow-[0_18px_50px_rgba(15,44,78,0.08)] backdrop-blur">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[#10213f]">
        {icon ? (
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8f7f8] text-[#0f8f99]">
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}
