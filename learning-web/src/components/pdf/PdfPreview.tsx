"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PdfPreviewProps = {
  url: string;
  title?: string;
  // 按需给 AI 看：只在请求时导出当前页截图（避免自动同步导致页面崩溃/卡顿）
  onRegisterVisionProvider?: (fn: (() => { page: number; pageCount: number; dataUrl: string } | null) | null) => void;
};

function usePdfjs() {
  return useMemo(async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    // 走 CDN worker，避免 Next 打包 worker 的复杂度
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs as any).GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
    return pdfjs;
  }, []);
}

function canvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  opts?: { maxWidth?: number; quality?: number },
): string {
  const maxWidth = opts?.maxWidth ?? 900;
  const quality = opts?.quality ?? 0.65;
  const w = canvas.width || 1;
  const h = canvas.height || 1;
  const scale = Math.min(1, maxWidth / w);
  const tw = Math.max(1, Math.floor(w * scale));
  const th = Math.max(1, Math.floor(h * scale));
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", quality);
  ctx.drawImage(canvas, 0, 0, tw, th);
  return out.toDataURL("image/jpeg", quality);
}

export function PdfPreview({ url, title, onRegisterVisionProvider }: PdfPreviewProps) {
  const canvasesRef = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [pages, setPages] = useState(0);
  const [rendered, setRendered] = useState<boolean[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scrollInfo, setScrollInfo] = useState({ top: 0, h: 0, ch: 0 });
  const pdfjsPromise = usePdfjs();

  // 注册“当前页截图导出器”给外部（AI 按需调用）
  useEffect(() => {
    if (!onRegisterVisionProvider) return;
    const fn = () => {
      const pageCount = pages;
      const page = Math.min(Math.max(currentPage, 1), Math.max(pageCount, 1));
      const canvas = canvasesRef.current[page - 1];
      if (!canvas || !canvas.width || !canvas.height) return null;
      const dataUrl = canvasToJpegDataUrl(canvas, { maxWidth: 900, quality: 0.65 });
      return { page, pageCount, dataUrl };
    };
    onRegisterVisionProvider(fn);
    return () => onRegisterVisionProvider(null);
  }, [onRegisterVisionProvider, pages, currentPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setPages(0);
      setRendered([]);
      canvasesRef.current = [];
      setCurrentPage(1);
      try {
        const pdfjs = await pdfjsPromise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadingTask: any = (pdfjs as any).getDocument({ url });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdf: any = await loadingTask.promise;
        if (cancelled) return;
        const total = Math.max(1, Number(pdf.numPages || 1));
        setPages(total);
        setRendered(Array.from({ length: total }, () => false));

        // 等待 DOM 生成 canvas（两帧更稳）
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        for (let i = 1; i <= total; i += 1) {
          if (cancelled) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdfPage: any = await pdf.getPage(i);
          if (cancelled) return;
          const viewport = pdfPage.getViewport({ scale: 1.35 });
          const canvas = canvasesRef.current[i - 1];
          if (!canvas) continue;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
          if (!cancelled) {
            setRendered((prev) => {
              if (!prev.length) return prev;
              const next = prev.slice();
              next[i - 1] = true;
              return next;
            });
          }
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "PDF 加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [pdfjsPromise, url]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-scroll overscroll-contain bg-[var(--shell-bg)] p-4 [scrollbar-gutter:stable]"
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          setScrollInfo({ top: el.scrollTop, h: el.scrollHeight, ch: el.clientHeight });
          if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
          scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null;
            const host = scrollRef.current;
            if (!host) return;
            const hostRect = host.getBoundingClientRect();
            const mid = (hostRect.top + hostRect.bottom) / 2;
            const els = pageElsRef.current;
            for (let i = 0; i < els.length; i += 1) {
              const it = els[i];
              if (!it) continue;
              const r = it.getBoundingClientRect();
              if (r.top <= mid && r.bottom >= mid) {
                setCurrentPage((prev) => (prev === i + 1 ? prev : i + 1));
                break;
              }
            }
          });
        }}
        onWheelCapture={(e) => {
          const el = scrollRef.current;
          if (!el) return;
          // 强制把滚动落到预览容器上，避免被外层布局“吃掉”
          if (e.deltaY !== 0) {
            e.preventDefault();
            el.scrollTop += e.deltaY;
            setScrollInfo({ top: el.scrollTop, h: el.scrollHeight, ch: el.clientHeight });
          }
        }}
        onMouseEnter={() => scrollRef.current?.focus()}
      >
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {err}
          </div>
        ) : (
          <div className="mx-auto w-fit space-y-4">
            <div className="text-center text-[12px] text-[var(--main-muted)]">
              {title ?? "PDF 预览"}
              {pages ? ` · 共 ${pages} 页` : ""}
              {loading ? " · 正在渲染…" : ""}
              <span className="ml-2 tabular-nums">
                · scroll {Math.round(scrollInfo.top)}/{Math.round(scrollInfo.h)} (vh{" "}
                {Math.round(scrollInfo.ch)})
              </span>
              {pages ? (
                <span className="ml-2 tabular-nums">· 当前页 {currentPage}/{pages}</span>
              ) : null}
            </div>

            {Array.from({ length: pages || 6 }).map((_, idx) => (
              <div
                key={idx}
                className="w-fit rounded-lg border border-[var(--border)] bg-white p-2 shadow-sm"
                ref={(el) => {
                  pageElsRef.current[idx] = el;
                }}
              >
                {pages === 0 || rendered[idx] === false ? (
                  <div className="flex min-h-[720px] items-center justify-center bg-white">
                    <div className="text-center text-[12px] text-[var(--main-muted)]">
                      {pages === 0 ? "正在加载 PDF…" : `正在渲染第 ${idx + 1} 页…`}
                    </div>
                  </div>
                ) : null}
                <canvas
                  ref={(el) => {
                    canvasesRef.current[idx] = el;
                  }}
                  className={rendered[idx] ? "block" : "hidden"}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

