"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ChevronRight, Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { postChat } from "@/lib/filesApi";

type Bubble = { role: "user" | "assistant"; text: string };

const STORAGE_KEY = "learningweb.agent.bubbles.v1";
const MAX_BUBBLES = 120;

export function AgentPanel({
  pdfVisionProvider,
  onToggleCollapse,
}: {
  pdfVisionProvider?: (() => { title: string; page: number; pageCount: number; dataUrl: string } | null) | null;
  onToggleCollapse?: () => void;
}) {
  const [message, setMessage] = useState("");
  const initialBubbles = useMemo<Bubble[]>(
    () => [
      {
        role: "assistant",
        text: "你好。我可以帮你：解释错题、总结知识点、再出相似练习题。直接输入问题，或选用下方快捷意图。",
      },
    ],
    [],
  );
  const [bubbles, setBubbles] = useState<Bubble[]>(initialBubbles);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attachPdfPage, setAttachPdfPage] = useState(true);

  // 恢复对话记录
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bubbles?: Bubble[] };
      if (Array.isArray(parsed?.bubbles) && parsed.bubbles.length) {
        const safe = parsed.bubbles
          .filter(
            (b) =>
              b &&
              (b.role === "user" || b.role === "assistant") &&
              typeof b.text === "string",
          )
          .slice(-MAX_BUBBLES);
        if (safe.length) setBubbles(safe);
      }
    } catch {
      // ignore
    }
  }, []);

  // 持久化对话记录（防抖）
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const safe = bubbles.slice(-MAX_BUBBLES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ bubbles: safe }));
      } catch {
        // ignore quota errors
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [bubbles]);

  const clearHistory = useCallback(() => {
    setBubbles(initialBubbles);
    setErr(null);
    setMessage("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [initialBubbles]);

  const send = useCallback(
    async (text: string, mode?: "explain" | "summarize" | "similar" | "free") => {
      const t = text.trim();
      if (!t || busy) return;
      setBusy(true);
      setErr(null);
      setBubbles((prev) => [...prev, { role: "user" as const, text: t }].slice(-MAX_BUBBLES));
      try {
        const providerFn = typeof pdfVisionProvider === "function" ? pdfVisionProvider : null;
        const shouldUseVision = attachPdfPage && Boolean(providerFn);
        const vision = shouldUseVision ? providerFn?.() ?? null : null;
        const image_urls = vision ? [vision.dataUrl] : undefined;
        const prefix = vision
          ? `【PDF 当前页】文件：${vision.title}；第 ${vision.page}/${vision.pageCount} 页。请结合图片回答。\n\n`
          : "";
        const r = await postChat({ message: prefix + t, mode, image_urls });
        setBubbles((prev) => [
          ...prev,
          { role: "assistant" as const, text: r.reply || "（无回复）" },
        ].slice(-MAX_BUBBLES));
        setMessage("");
      } catch (e) {
        const em = e instanceof Error ? e.message : "请求失败";
        setErr(em);
        setBubbles((prev) => [
          ...prev,
          {
            role: "assistant" as const,
            text: `请求失败：${em}`,
          },
        ].slice(-MAX_BUBBLES));
      } finally {
        setBusy(false);
      }
    },
    [busy, attachPdfPage, pdfVisionProvider],
  );

  const sendWithCurrentPage = useCallback(async () => {
    if (busy) return;
    const t = message.trim();
    if (!t) return;
    if (typeof pdfVisionProvider !== "function") {
      setErr("未检测到可用的 PDF 预览（请先在中间区域打开一个 PDF）。");
      return;
    }
    void send(t, "free");
  }, [busy, message, pdfVisionProvider, send]);

  return (
    <aside
      className="flex h-full w-[340px] shrink-0 flex-col border-l border-[var(--agent-border)] bg-gradient-to-b from-[#f6f8fc] via-[var(--agent-bg)] to-[#eef2fa]"
      aria-label="AI 学习助手"
    >
      <div className="relative shrink-0 overflow-hidden border-b border-[var(--agent-border)] bg-white/80 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--accent-soft)] blur-2xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[#4a9eed] text-white shadow-md">
            <Bot className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-[var(--agent-fg)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              AI 学习助手
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--agent-muted)]">
              <code className="rounded-md bg-[var(--chip-bg)] px-1.5 py-0.5 text-[10px]">
                POST /api/chat
              </code>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--agent-muted)]">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={attachPdfPage}
                  onChange={(e) => setAttachPdfPage(e.target.checked)}
                />
                发送时让 AI 看当前页
              </label>
              <span className="rounded-full border border-[var(--agent-border)] bg-white px-2 py-0.5">
                {pdfVisionProvider ? "已连接 PDF 预览" : "未连接 PDF 预览"}
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full border border-[var(--agent-border)] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[var(--agent-fg)] shadow-sm transition hover:bg-[var(--chip-bg)]"
                title="清空对话记录"
              >
                清空对话
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-[var(--agent-border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--agent-fg)] shadow-sm transition hover:border-[var(--accent)]/40 hover:shadow disabled:opacity-50"
                onClick={() =>
                  void send("请说明：如何判断一道树相关题目（或图论题）我总在哪儿出错？", "explain")
                }
              >
                解释易错
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-[var(--agent-border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--agent-fg)] shadow-sm transition hover:border-[var(--accent)]/40 hover:shadow disabled:opacity-50"
                onClick={() =>
                  void send("请把我最近错题里最常出现的知识点列成条目。", "summarize")
                }
              >
                总结知识点
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full border border-[var(--agent-border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--agent-fg)] shadow-sm transition hover:border-[var(--accent)]/40 hover:shadow disabled:opacity-50"
                onClick={() =>
                  void send("请根据我上一条描述的知识点，再出两道举一反三的练习题。", "similar")
                }
              >
                再出题
              </button>
            </div>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--agent-border)] bg-white text-[var(--agent-fg)] shadow-sm transition hover:bg-[var(--chip-bg)]"
              title="收起 AI 助手"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
        {err ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-900 shadow-sm">
            {err}
          </div>
        ) : null}
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={`rounded-2xl border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm transition duration-200 ${
              b.role === "user"
                ? "ml-6 border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent-soft)] to-white text-[var(--main-fg)]"
                : "mr-4 border-white/80 bg-white/90 text-[var(--agent-fg)] shadow-[var(--shadow-card)]"
            }`}
          >
            {b.role === "assistant" ? (
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                <MessageCircle className="h-3 w-3" />
                助手
              </span>
            ) : (
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--main-muted)]">
                你
              </span>
            )}
            {b.text}
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2 pl-1 text-[12px] text-[var(--agent-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            思考中…
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--agent-border)] bg-white/90 p-3 backdrop-blur-md">
        <div className="flex gap-2 rounded-2xl border border-[var(--agent-border)] bg-[var(--agent-input-bg)] p-2 shadow-inner transition focus-within:border-[var(--accent)]/35 focus-within:ring-2 focus-within:ring-[var(--accent)]/15">
          <textarea
            className="max-h-28 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-[var(--agent-fg)] outline-none placeholder:text-[var(--agent-muted)]"
            placeholder="例如：这道极限我总在换元时漏条件…"
            rows={2}
            value={message}
            disabled={busy}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(message, "free");
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !message.trim()}
            className="self-end flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-md transition hover:opacity-95 disabled:opacity-40"
            title="发送"
            onClick={() => void send(message, "free")}
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            disabled={busy || !message.trim() || !pdfVisionProvider}
            className="rounded-xl border border-[var(--agent-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--agent-fg)] shadow-sm transition hover:bg-[var(--chip-bg)] disabled:opacity-40"
            onClick={sendWithCurrentPage}
            title="把当前页截图发给 AI 再回答"
          >
            让 AI 看当前页再回答
          </button>
          <span className="text-[11px] text-[var(--agent-muted)]">
            建议提问：这一页讲了什么 / 总结这一页要点
          </span>
        </div>
      </div>
    </aside>
  );
}
