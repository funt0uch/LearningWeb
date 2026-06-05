"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { postChat } from "@/lib/filesApi";

type Bubble = { role: "user" | "assistant"; text: string };
type VisionProvider = () => { title: string; page: number; pageCount: number; dataUrl: string } | null;

const STORAGE_KEY = "learningweb.agent.bubbles.v1";
const MAX_BUBBLES = 120;

const WELCOME: Bubble = {
  role: "assistant",
  text: "你好，我是 LearningWeb 学习助手。打开 PDF 后，我可以结合当前页解释题目、总结知识点，或者继续生成相似练习。",
};

const PROMPTS = [
  "这一页的核心知识点是什么？",
  "这道题最容易错在哪里？",
  "把这一页整理成复习提纲",
  "基于当前内容出两道相似题",
  "这类题的通用解题步骤是什么？",
  "帮我归纳本页公式和适用条件",
];

export function AgentPanel({
  pdfVisionProvider,
  onToggleCollapse,
}: {
  pdfVisionProvider?: VisionProvider | null;
  onToggleCollapse?: () => void;
}) {
  const initialBubbles = useMemo<Bubble[]>(() => [WELCOME], []);
  const [message, setMessage] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>(initialBubbles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachPdfPage, setAttachPdfPage] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bubbles?: Bubble[] };
      const safe = parsed.bubbles
        ?.filter(
          (item) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.text === "string",
        )
        .slice(-MAX_BUBBLES);
      if (safe?.length) setBubbles(safe);
    } catch {
      // Local chat history is optional.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ bubbles: bubbles.slice(-MAX_BUBBLES) }),
        );
      } catch {
        // Ignore quota errors.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [bubbles]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [bubbles, busy, error]);

  const clearHistory = useCallback(() => {
    setBubbles(initialBubbles);
    setError(null);
    setMessage("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }, [initialBubbles]);

  const send = useCallback(
    async (text: string, mode?: "explain" | "summarize" | "similar" | "free") => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      setBusy(true);
      setError(null);
      setBubbles((prev) =>
        [...prev, { role: "user" as const, text: trimmed }].slice(-MAX_BUBBLES),
      );

      try {
        const vision = attachPdfPage && pdfVisionProvider ? pdfVisionProvider() : null;
        const prefix = vision
          ? `【PDF 当前页】文件：${vision.title}；第 ${vision.page}/${vision.pageCount} 页。请结合图片内容回答。\n\n`
          : "";
        const result = await postChat({
          message: prefix + trimmed,
          mode,
          image_urls: vision ? [vision.dataUrl] : undefined,
        });
        setBubbles((prev) =>
          [
            ...prev,
            {
              role: "assistant" as const,
              text: result.reply || "我暂时没有生成有效回复，可以换个问法再试一次。",
            },
          ].slice(-MAX_BUBBLES),
        );
        setMessage("");
      } catch (err) {
        const text = err instanceof Error ? err.message : "请求失败";
        setError(text);
        setBubbles((prev) =>
          [...prev, { role: "assistant" as const, text: `请求失败：${text}` }].slice(
            -MAX_BUBBLES,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [attachPdfPage, busy, pdfVisionProvider],
  );

  const sendWithCurrentPage = useCallback(() => {
    if (!message.trim() || busy) return;
    if (!pdfVisionProvider) {
      setError("请先在中间区域打开一个 PDF，再让 AI 结合当前页回答。");
      return;
    }
    void send(message, "free");
  }, [busy, message, pdfVisionProvider, send]);

  return (
    <aside
      className="flex h-full w-[360px] shrink-0 flex-col border-l border-[var(--agent-border)] bg-[var(--agent-bg)]/95 backdrop-blur-xl"
      aria-label="AI 学习助手"
    >
      <div className="lw-hairline-top shrink-0 border-b border-[var(--agent-border)] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="lw-scan grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-white shadow-[0_12px_24px_-14px_var(--accent-glow)]">
            <Bot className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-[15px] font-black tracking-tight text-[var(--agent-fg)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              AI 学习助手
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--agent-muted)]">
              结合 PDF 页面回答，也可以独立解释知识点。
            </p>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--agent-border)] bg-[var(--agent-bubble-bg)] text-[var(--agent-muted)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
              title="收起 AI 助手"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--agent-muted)]">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              className="accent-[var(--accent)]"
              type="checkbox"
              checked={attachPdfPage}
              onChange={(event) => setAttachPdfPage(event.target.checked)}
            />
            发送时附带当前 PDF 页
          </label>
          <span className="rounded-lg border border-[var(--agent-border)] bg-[var(--agent-bubble-bg)] px-2 py-1 shadow-[var(--shadow-sm)]">
            {pdfVisionProvider ? "PDF 预览已连接" : "未打开 PDF"}
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--agent-border)] bg-[var(--agent-bubble-bg)] py-2 shadow-[var(--shadow-sm)]">
          <div className="learning-marquee flex w-max gap-2 px-2">
            {[...PROMPTS, ...PROMPTS].map((prompt, index) => (
              <button
                key={`${prompt}-${index}`}
                type="button"
                disabled={busy}
                onClick={() => void send(prompt, "free")}
                className="rounded-lg border border-[var(--agent-border)] bg-[var(--main-bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--agent-fg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:border-[var(--accent)]/40 hover:text-[var(--accent)] disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="lw-scroll-fade min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 shadow-sm">
            {error}
          </div>
        ) : null}

        {bubbles.map((bubble, index) => (
          <div
            key={`${bubble.role}-${index}`}
            className={`lw-reveal rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-[var(--shadow-sm)] ${
              bubble.role === "user"
                ? "ml-6 border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--agent-fg)]"
                : "mr-4 border-[var(--agent-border)] bg-[var(--agent-bubble-bg)] text-[var(--agent-fg)]"
            }`}
          >
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">
              {bubble.role === "assistant" ? <MessageCircle className="h-3 w-3" /> : null}
              {bubble.role === "assistant" ? "助手" : "你"}
            </span>
            {bubble.text}
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 pl-1 text-[12px] text-[var(--agent-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            正在思考...
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--agent-border)] bg-[var(--agent-bg)] p-3">
        <div className="flex gap-2 rounded-lg border border-[var(--agent-border)] bg-[var(--agent-input-bg)] p-2 shadow-inner transition focus-within:border-[var(--accent)]/50 focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
          <textarea
            className="max-h-28 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-[var(--agent-fg)] outline-none placeholder:text-[var(--agent-muted)]"
            placeholder="例如：这一页的重点是什么？这道题为什么选 B？"
            rows={2}
            value={message}
            disabled={busy}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(message, "free");
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !message.trim()}
            className="self-end grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:opacity-95 disabled:translate-y-0 disabled:opacity-40"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--agent-border)] bg-[var(--agent-bubble-bg)] px-3 py-2 text-[12px] font-bold text-[var(--agent-fg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)] disabled:translate-y-0 disabled:opacity-40"
            onClick={sendWithCurrentPage}
            title="把当前 PDF 页截图发给 AI 后再回答"
          >
            <Paperclip className="h-3.5 w-3.5" />
            结合当前页
          </button>
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold text-[var(--agent-muted)] transition hover:bg-[var(--chip-bg)] hover:text-[var(--agent-fg)]"
            title="清空对话记录"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空
          </button>
        </div>
      </div>
    </aside>
  );
}
