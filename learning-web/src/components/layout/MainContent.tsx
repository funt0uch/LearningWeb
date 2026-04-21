"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KnowledgeGraphTree } from "@/components/learning/KnowledgeGraphTree";
import {
  deleteFile,
  fileDownloadUrl,
  getKnowledgeStats,
  listFiles,
  uploadFile,
  wrongQuestionsFromPdf,
} from "@/lib/filesApi";
import { getKnowledgeGraph, getReviewRecommendations } from "@/lib/learningApi";
import type {
  IndexedFileItem,
  KnowledgeStatsResponse,
  MockFileItem,
  WrongQuestionsFromPdfResponse,
} from "@/types/folder";
import { PdfPreview } from "@/components/pdf/PdfPreview";

const kindLabel: Record<MockFileItem["kind"], string> = {
  note: "笔记",
  pdf: "PDF",
  sheet: "表格",
};

type MainContentProps = {
  folderLabel: string;
  files: MockFileItem[];
  selectedId: string;
  canDelete: boolean;
  onDeleteCurrent: () => void;
  onRegisterPdfVisionProvider?: (
    fn: (() => { title: string; page: number; pageCount: number; dataUrl: string } | null) | null,
  ) => void;
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fileIcon(type: string, name: string): string {
  const lower = name.toLowerCase();
  if (type.includes("pdf") || lower.endsWith(".pdf")) return "PDF";
  if (type.includes("word") || lower.endsWith(".doc") || lower.endsWith(".docx"))
    return "DOC";
  if (type.includes("excel") || lower.endsWith(".xls") || lower.endsWith(".xlsx"))
    return "XLS";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
    return "IMG";
  return "FILE";
}

const WQ_PAGE_SIZE = 5;

function isPdfIndexed(f: IndexedFileItem): boolean {
  return f.type.toLowerCase().includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
}

function difficultyLabel(d: WrongQuestionsFromPdfResponse["items"][number]["difficulty"]): string {
  if (d === "easy") return "容易";
  if (d === "hard") return "困难";
  return "中等";
}

export function MainContent({
  folderLabel,
  files,
  selectedId,
  canDelete,
  onDeleteCurrent,
  onRegisterPdfVisionProvider,
}: MainContentProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fileItems, setFileItems] = useState<IndexedFileItem[]>([]);
  const [activeFile, setActiveFile] = useState<IndexedFileItem | null>(null);
  const [wq, setWq] = useState<WrongQuestionsFromPdfResponse | null>(null);
  const [wqForId, setWqForId] = useState<string | null>(null);
  const [wqBusy, setWqBusy] = useState(false);
  const [wqErr, setWqErr] = useState<string | null>(null);
  const [wqPage, setWqPage] = useState(0);
  const [kstats, setKstats] = useState<KnowledgeStatsResponse | null>(null);
  const [reviewToday, setReviewToday] = useState<string[]>([]);
  const [graphTree, setGraphTree] = useState<Record<string, unknown> | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const activeIsPdf = useMemo(() => {
    if (!activeFile) return false;
    const t = activeFile.type.toLowerCase();
    const n = activeFile.name.toLowerCase();
    return t.includes("pdf") || n.endsWith(".pdf");
  }, [activeFile]);

  const activeUrl = activeFile ? fileDownloadUrl(activeFile.id) : "";
  const activeTitle = activeFile?.name || "";

  const registerVisionProvider = useCallback(
    (
      fn:
        | (() => { page: number; pageCount: number; dataUrl: string } | null)
        | null,
    ) => {
      onRegisterPdfVisionProvider?.(
        fn
          ? () => {
              const r = fn();
              if (!r) return null;
              return { title: activeTitle, ...r };
            }
          : null,
      );
    },
    [onRegisterPdfVisionProvider, activeTitle],
  );

  // 阅读 PDF 时默认收起顶部概览区，避免“看着变扭”
  useEffect(() => {
    if (activeFile && activeIsPdf) setHeaderCollapsed(true);
  }, [activeFile, activeIsPdf]);

  // 切换文件时清空“按需视觉提供器”
  useEffect(() => {
    onRegisterPdfVisionProvider?.(null);
  }, [activeUrl, onRegisterPdfVisionProvider]);

  useEffect(() => {
    let cancelled = false;
    setActiveFile(null);
    setErr(null);
    if (!selectedId) {
      setFileItems([]);
      return;
    }
    (async () => {
      try {
        const list = await listFiles(selectedId);
        if (!cancelled) setFileItems(list);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "加载文件列表失败");
          setFileItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const k = await getKnowledgeStats();
        if (!cancelled) setKstats(k);
      } catch {
        if (!cancelled) setKstats(null);
      }
      try {
        const rv = await getReviewRecommendations(8);
        if (!cancelled) setReviewToday(rv.today ?? []);
      } catch {
        if (!cancelled) setReviewToday([]);
      }
      try {
        const g = await getKnowledgeGraph();
        if (!cancelled) setGraphTree((g.tree as Record<string, unknown>) ?? null);
      } catch {
        if (!cancelled) setGraphTree(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wq]);

  async function refresh() {
    if (!selectedId) return;
    const list = await listFiles(selectedId);
    setFileItems(list);
  }

  async function handleUpload(filesToUpload: FileList | null) {
    if (!filesToUpload?.length || !selectedId) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(filesToUpload)) {
        await uploadFile({ folderId: selectedId, file: f });
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleWrongQuestions(f: IndexedFileItem) {
    setActiveFile(f);
    setWqBusy(true);
    setWqErr(null);
    try {
      const r = await wrongQuestionsFromPdf(f.id);
      setWq(r);
      setWqForId(f.id);
      setWqPage(0);
    } catch (e) {
      setWq(null);
      setWqForId(f.id);
      setWqErr(e instanceof Error ? e.message : "整理失败");
    } finally {
      setWqBusy(false);
    }
  }

  async function handleDeleteFile(id: string) {
    if (!window.confirm("确定删除该文件？")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteFile(id);
      if (activeFile?.id === id) setActiveFile(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--main-bg)]">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--main-surface)] px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--main-fg)]">
              {folderLabel}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--main-muted)]">
              {files.length} 个条目 · 卡片仍为 mock · 目录由 FastAPI 写入{" "}
              <code className="rounded bg-[var(--chip-bg)] px-1 text-[12px]">
                folders.json
              </code>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHeaderCollapsed((v) => !v)}
              className="shrink-0 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--main-fg)] hover:bg-[var(--chip-bg)]"
              title="收起/展开顶部概览区（薄弱知识点/推荐复习/知识点关系图）"
            >
              {headerCollapsed ? "展开概览" : "收起概览"}
            </button>
            {canDelete && selectedId ? (
              <button
                type="button"
                onClick={onDeleteCurrent}
                className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100"
              >
                删除当前文件夹
              </button>
            ) : null}
          </div>
        </div>
        {!headerCollapsed && kstats && kstats.weak_top5.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-white/60 px-4 py-3">
            <p className="text-[12px] font-semibold text-[var(--main-fg)]">
              薄弱知识点 TOP5（全库错题聚合）
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
              {kstats.weak_top5.map((row, i) => (
                <li
                  key={row.name}
                  className="flex items-baseline justify-between gap-2 text-[var(--main-muted)]"
                >
                  <span>
                    <span className="text-[var(--main-muted)]">{i + 1}. </span>
                    <span className="font-medium text-[var(--main-fg)]">{row.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {row.wrong_count} 次 · 难度均 {row.avg_difficulty.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!headerCollapsed && reviewToday.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3">
            <p className="text-[12px] font-semibold text-[var(--main-fg)]">
              今日建议复习（智能推荐）
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {reviewToday.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-[var(--border)] bg-white px-2.5 py-0.5 text-[11px] text-[var(--main-fg)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!headerCollapsed && graphTree && Object.keys(graphTree).length > 0 ? (
          <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-[var(--main-fg)]">
              知识点关系图（基于错题标签拆解）
            </summary>
            <div className="mt-3 max-h-[280px] overflow-auto pr-1">
              <KnowledgeGraphTree data={graphTree} />
            </div>
          </details>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0">
          <div className="flex min-h-0 w-[360px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--main-surface)]">
            <div className="shrink-0 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[var(--main-fg)]">
                  文件
                </p>
                <button
                  type="button"
                  disabled={!selectedId || busy}
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  上传
                </button>
                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(e) => void handleUpload(e.target.files)}
                />
              </div>
              {err ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {err}
                </div>
              ) : null}
              <p className="mt-2 text-[12px] text-[var(--main-muted)]">
                保存到 <code className="rounded bg-[var(--chip-bg)] px-1">E:\LearningWeb\data\files</code>
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
              {fileItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-[13px] text-[var(--main-muted)]">
                  暂无文件，点击右上角“上传”
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {fileItems.map((f) => {
                    const active = activeFile?.id === f.id;
                    return (
                      <li key={f.id}>
                        <div
                          className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                            active
                              ? "border-[var(--border-strong)] bg-[var(--chip-bg)]"
                              : "border-transparent hover:bg-[var(--sidebar-hover)]"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            onClick={() => setActiveFile(f)}
                          >
                            <span className="inline-flex h-8 w-10 items-center justify-center rounded-md bg-[var(--chip-bg)] text-[11px] font-bold text-[var(--chip-fg)]">
                              {fileIcon(f.type, f.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-[var(--main-fg)]">
                                {f.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-[var(--main-muted)]">
                                {formatSize(f.size)} · {formatTime(f.uploadedAt)}
                              </span>
                            </span>
                          </button>
                          {isPdfIndexed(f) ? (
                            <button
                              type="button"
                              className="shrink-0 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] font-medium text-[var(--main-fg)] hover:bg-[var(--chip-bg)] disabled:opacity-50"
                              disabled={busy || wqBusy}
                              title="调用后端 LLM 整理错题"
                              onClick={() => void handleWrongQuestions(f)}
                            >
                              整理错题
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-[12px] text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleDeleteFile(f.id)}
                          >
                            删除
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {activeFile && activeIsPdf ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
                  <PdfPreview
                    url={activeUrl}
                    title={activeFile.name}
                    onRegisterVisionProvider={registerVisionProvider}
                  />
                </div>
                {wqForId === activeFile.id && (wq || wqErr) ? (
                  <section className="min-h-0 shrink-0 border-t border-[var(--border)] bg-[var(--main-surface)]">
                    <div className="max-h-[42vh] overflow-auto px-6 py-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-[13px] font-semibold text-[var(--main-fg)]">
                          错题整理结果
                        </h2>
                        {wq ? (
                          <span className="text-[11px] text-[var(--main-muted)]">
                            {wq.degraded ? "已降级" : "校验通过"}
                            {wq.vision_used ? " · 含多模态" : ""} · 尝试轮次{" "}
                            {wq.retries_used}
                            {wq.saved_path ? ` · ${wq.saved_path}` : ""}
                          </span>
                        ) : null}
                      </div>
                      {wqErr ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                          {wqErr}
                        </div>
                      ) : wq ? (
                        <>
                          <p className="mb-3 text-[12px] leading-relaxed text-[var(--main-muted)]">
                            {wq.summary}
                          </p>
                          {wq.items.length === 0 ? (
                            <p className="text-[13px] text-[var(--main-muted)]">未识别到题目条目。</p>
                          ) : (
                            <>
                              <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--main-muted)]">
                                <span>
                                  共 {wq.items.length} 题，第 {wqPage + 1}/
                                  {Math.max(1, Math.ceil(wq.items.length / WQ_PAGE_SIZE))} 页
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={wqPage <= 0}
                                    className="rounded border border-[var(--border)] bg-white px-2 py-0.5 disabled:opacity-40"
                                    onClick={() => setWqPage((p) => Math.max(0, p - 1))}
                                  >
                                    上一页
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      wqPage >=
                                      Math.ceil(wq.items.length / WQ_PAGE_SIZE) - 1
                                    }
                                    className="rounded border border-[var(--border)] bg-white px-2 py-0.5 disabled:opacity-40"
                                    onClick={() =>
                                      setWqPage((p) =>
                                        Math.min(
                                          Math.max(
                                            0,
                                            Math.ceil(wq.items.length / WQ_PAGE_SIZE) - 1,
                                          ),
                                          p + 1,
                                        ),
                                      )
                                    }
                                  >
                                    下一页
                                  </button>
                                </div>
                              </div>
                              <ul className="flex flex-col gap-2">
                                {wq.items
                                  .slice(
                                    wqPage * WQ_PAGE_SIZE,
                                    wqPage * WQ_PAGE_SIZE + WQ_PAGE_SIZE,
                                  )
                                  .map((it, idx) => (
                                    <li key={`${wqPage}-${idx}`}>
                                      <details className="group rounded-lg border border-[var(--border)] bg-white open:border-[var(--border-strong)]">
                                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 px-3 py-2 text-[13px] font-medium text-[var(--main-fg)] marker:content-none [&::-webkit-details-marker]:hidden">
                                          <span className="mr-2 text-[var(--main-muted)]">
                                            #{wqPage * WQ_PAGE_SIZE + idx + 1}
                                          </span>
                                          <span className="min-w-0 flex-1 line-clamp-1">
                                            {it.question}
                                          </span>
                                          <span className="shrink-0 text-[11px] font-normal text-[var(--main-muted)]">
                                            第 {it.source_page} 页 ·{" "}
                                            {difficultyLabel(it.difficulty)}
                                          </span>
                                          {it.item_id ? (
                                            <Link
                                              href={`/wrong/${it.item_id}`}
                                              className="shrink-0 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              详情页
                                            </Link>
                                          ) : null}
                                        </summary>
                                        <div className="space-y-2 border-t border-[var(--border)] px-3 py-3 text-[12px] leading-relaxed">
                                          <p>
                                            <span className="font-semibold text-[var(--main-fg)]">
                                              知识点：
                                            </span>{" "}
                                            {it.knowledge_point}
                                          </p>
                                          <p>
                                            <span className="font-semibold text-[var(--main-fg)]">
                                              答案：
                                            </span>{" "}
                                            {it.answer || "—"}
                                          </p>
                                          <p className="text-[var(--main-muted)]">
                                            <span className="font-semibold text-[var(--main-fg)]">
                                              解析：
                                            </span>{" "}
                                            {it.analysis}
                                          </p>
                                          {it.related_image_paths?.length ? (
                                            <p className="break-all text-[11px] text-[var(--main-muted)]">
                                              <span className="font-semibold text-[var(--main-fg)]">
                                                关联图片：
                                              </span>{" "}
                                              {it.related_image_paths.join("；")}
                                            </p>
                                          ) : null}
                                        </div>
                                      </details>
                                    </li>
                                  ))}
                              </ul>
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--main-surface)] px-6 py-10 text-center text-[13px] text-[var(--main-muted)]">
                  {activeFile
                    ? "该文件暂不支持预览（当前仅实现 PDF.js 预览）"
                    : "从左侧列表选择一个文件预览（PDF 优先）"}
                </div>

                <div className="mt-8">
                  <p className="mb-3 text-[13px] font-semibold text-[var(--main-fg)]">
                    资料卡片（mock）
                  </p>
                  {files.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--main-surface)] px-6 py-12 text-center text-[13px] text-[var(--main-muted)]">
                      此文件夹暂无内容
                    </div>
                  ) : (
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                      {files.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            className="group flex h-full w-full flex-col rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-[var(--border-strong)] hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
                          >
                            <span className="mb-2 inline-flex w-fit rounded-md bg-[var(--chip-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--chip-fg)]">
                              {kindLabel[file.kind]}
                            </span>
                            <span className="line-clamp-2 text-[15px] font-medium leading-snug text-[var(--main-fg)] group-hover:text-[var(--accent)]">
                              {file.title}
                            </span>
                            <span className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-[var(--main-muted)]">
                              {file.preview}
                            </span>
                            <span className="mt-3 text-[12px] text-[var(--main-muted)]">
                              更新于 {file.updatedAt}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
