"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { getWrongItem, postChat } from "@/lib/filesApi";
import { postPracticeGenerate, postPracticeSubmit } from "@/lib/learningApi";
import { recordStudyEvent } from "@/lib/studyApi";
import type { WrongItemDetailResponse } from "@/types/folder";

function difficultyZh(d: string): string {
  if (d === "easy") return "容易";
  if (d === "hard") return "困难";
  return "中等";
}

export default function WrongQuestionDetailPage() {
  const params = useParams();
  const itemId = typeof params?.itemId === "string" ? params.itemId : "";
  const [data, setData] = useState<WrongItemDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [similarText, setSimilarText] = useState<string | null>(null);
  const [similarBusy, setSimilarBusy] = useState(false);
  const [practiceStem, setPracticeStem] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceEval, setPracticeEval] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let c = false;
    void (async () => {
      try {
        const r = await getWrongItem(itemId);
        if (!c) {
          setData(r);
          setErr(null);
          void recordStudyEvent({ action: "view", itemId }).catch(() => {});
        }
      } catch (e) {
        if (!c) {
          setData(null);
          setErr(e instanceof Error ? e.message : "加载失败");
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [itemId]);

  const loadSimilar = useCallback(async () => {
    const it = data?.item;
    if (!it?.question) return;
    setSimilarBusy(true);
    setSimilarText(null);
    try {
      const r = await postChat({
        message: `下面是一道错题，请基于相同知识点再出 1～2 道相似练习题（附答案要点）：\n\n【题干】${it.question}\n【知识点】${it.knowledge_point}`,
        mode: "similar",
      });
      setSimilarText(r.reply);
    } catch (e) {
      setSimilarText(e instanceof Error ? e.message : "生成失败");
    } finally {
      setSimilarBusy(false);
    }
  }, [data]);

  const startPractice = useCallback(async () => {
    if (!itemId) return;
    setPracticeBusy(true);
    setPracticeEval(null);
    try {
      const r = await postPracticeGenerate(itemId);
      setPracticeId(r.practice_id);
      setPracticeStem(r.stem);
      void recordStudyEvent({
        action: "practice_start",
        itemId,
        meta: { practice_id: r.practice_id },
      }).catch(() => {});
    } catch (e) {
      setPracticeStem(e instanceof Error ? e.message : "生成失败");
      setPracticeId(null);
    } finally {
      setPracticeBusy(false);
    }
  }, [itemId]);

  const submitPractice = useCallback(async () => {
    if (!practiceId || !practiceAnswer.trim()) return;
    setPracticeBusy(true);
    try {
      const r = await postPracticeSubmit(practiceId, practiceAnswer);
      setPracticeEval(
        `得分：${r.score ?? "—"} · ${r.verdict}\n${r.feedback}`,
      );
      void recordStudyEvent({
        action: "practice_submit",
        itemId: itemId || undefined,
        meta: { practice_id: practiceId, score: r.score },
      }).catch(() => {});
    } catch (e) {
      setPracticeEval(e instanceof Error ? e.message : "提交失败");
    } finally {
      setPracticeBusy(false);
    }
  }, [practiceId, practiceAnswer, itemId]);

  const it = data?.item;

  return (
    <div className="min-h-screen bg-[var(--main-bg)] text-[var(--main-fg)]">
      <TopNav title="错题详情" />
      <main className="mx-auto max-w-3xl px-6 py-8">
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {err}
          </div>
        ) : null}
        {!it && !err ? (
          <p className="text-[13px] text-[var(--main-muted)]">加载中…</p>
        ) : null}
        {it ? (
          <article className="space-y-6">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--main-surface)] p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--main-muted)]">
                题目 · 第 {it.source_page} 页 · {difficultyZh(it.difficulty)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
                {it.question}
              </p>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">答案</h2>
              <p className="mt-2 whitespace-pre-wrap text-[14px] text-[var(--main-muted)]">
                {it.answer || "—"}
              </p>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">AI 解析</h2>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--main-fg)]">
                {it.analysis}
              </p>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">知识点</h2>
              <p className="mt-2 text-[14px] font-medium text-[var(--accent)]">
                {it.knowledge_point}
              </p>
            </section>
            {it.related_image_paths && it.related_image_paths.length > 0 ? (
              <section className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">
                  关联图片路径
                </h2>
                <ul className="mt-2 list-inside list-disc break-all text-[12px] text-[var(--main-muted)]">
                  {it.related_image_paths.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">
                错题再练（结构化练习）
              </h2>
              <p className="mt-1 text-[12px] text-[var(--main-muted)]">
                基于本题生成新题干，作答后由模型简评（区别于上方自由文本相似题）。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={practiceBusy}
                  className="rounded-lg border border-[var(--border)] bg-[var(--chip-bg)] px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
                  onClick={() => void startPractice()}
                >
                  {practiceBusy && !practiceStem ? "出题中…" : "生成同类练习题"}
                </button>
              </div>
              {practiceStem ? (
                <div className="mt-4 space-y-3">
                  <p className="whitespace-pre-wrap rounded-md bg-[var(--chip-bg)] px-3 py-2 text-[13px] leading-relaxed">
                    {practiceStem}
                  </p>
                  <textarea
                    className="min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
                    placeholder="在此写下你的解答…"
                    value={practiceAnswer}
                    onChange={(e) => setPracticeAnswer(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={practiceBusy || !practiceAnswer.trim()}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
                    onClick={() => void submitPractice()}
                  >
                    提交批改
                  </button>
                  {practiceEval ? (
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--main-fg)]">
                      {practiceEval}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
            <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--chip-bg)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">
                  相似题推荐
                </h2>
                <button
                  type="button"
                  disabled={similarBusy}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  onClick={() => void loadSimilar()}
                >
                  {similarBusy ? "生成中…" : "AI 生成相似题"}
                </button>
              </div>
              {similarText ? (
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--main-fg)]">
                  {similarText}
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--main-muted)]">
                  点击按钮，通过后端对话接口生成举一反三练习（需配置 LLM）。
                </p>
              )}
            </section>
          </article>
        ) : null}
      </main>
    </div>
  );
}
