"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  FileText,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { KnowledgeGraphTree } from "@/components/learning/KnowledgeGraphTree";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import {
  deleteFile,
  fileDownloadUrl,
  generatePdfReport,
  getKnowledgeStats,
  listFiles,
  uploadFile,
} from "@/lib/filesApi";
import { getKnowledgeGraph, getReviewRecommendations } from "@/lib/learningApi";
import type {
  IndexedFileItem,
  KnowledgeStatsResponse,
  MockFileItem,
  PdfReportType,
  TreeNode,
} from "@/types/folder";

type MainContentProps = {
  folderLabel: string;
  files: MockFileItem[];
  selectedId: string;
  folderTree: TreeNode[];
  canDelete: boolean;
  onDeleteCurrent: () => void;
  onCreateFolder: (parentId: string | null, label?: string) => TreeNode;
  onSelectFolder: (folderId: string) => void;
  onRegisterPdfVisionProvider?: (
    fn: (() => { title: string; page: number; pageCount: number; dataUrl: string } | null) | null,
  ) => void;
};

type FolderOption = {
  id: string;
  label: string;
  depth: number;
};

type ReportDraft = {
  file: IndexedFileItem;
  type: PdfReportType;
} | null;

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function isPdfFile(file: IndexedFileItem): boolean {
  return file.type.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
}

function fileBadge(file: IndexedFileItem): string {
  if (isGeneratedReport(file)) return "报告";
  const name = file.name.toLowerCase();
  if (isPdfFile(file)) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOC";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "XLS";
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "IMG";
  return "FILE";
}

function readableKindLabel(kind: MockFileItem["kind"]): string {
  if (kind === "note") return "笔记";
  if (kind === "sheet") return "表格";
  return "PDF";
}

function isGeneratedReport(file: IndexedFileItem): boolean {
  const marker = file.generatedBy ?? "";
  return (
    marker.startsWith("pdf-report:") ||
    file.name.includes("知识点总结报告") ||
    file.name.includes("错题整理报告")
  );
}

function flattenFolders(nodes: TreeNode[], depth = 0): FolderOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: node.label, depth },
    ...flattenFolders(node.children ?? [], depth + 1),
  ]);
}

function recommendedFolderName(type: PdfReportType) {
  return type === "wrong" ? "错题整理" : "知识点总结";
}

export function MainContent({
  folderLabel,
  files,
  selectedId,
  folderTree,
  canDelete,
  onDeleteCurrent,
  onCreateFolder,
  onSelectFolder,
  onRegisterPdfVisionProvider,
}: MainContentProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileItems, setFileItems] = useState<IndexedFileItem[]>([]);
  const [activeFile, setActiveFile] = useState<IndexedFileItem | null>(null);
  const [query, setQuery] = useState("");
  const [fileKind, setFileKind] = useState<"all" | "pdf" | "other">("all");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [fileListOpen, setFileListOpen] = useState(true);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStatsResponse | null>(null);
  const [reviewToday, setReviewToday] = useState<string[]>([]);
  const [graphTree, setGraphTree] = useState<Record<string, unknown> | null>(null);
  const [reportBusy, setReportBusy] = useState<{ fileId: string; type: PdfReportType } | null>(
    null,
  );
  const [reportDraft, setReportDraft] = useState<ReportDraft>(null);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  const folderOptions = useMemo(() => flattenFolders(folderTree), [folderTree]);
  const activeUrl = activeFile ? fileDownloadUrl(activeFile.id) : "";
  const activeIsPdf = activeFile ? isPdfFile(activeFile) : false;

  const filteredFiles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return fileItems.filter((file) => {
      const isPdf = isPdfFile(file);
      if (fileKind === "pdf" && !isPdf) return false;
      if (fileKind === "other" && isPdf) return false;
      if (!keyword) return true;
      return file.name.toLowerCase().includes(keyword) || file.type.toLowerCase().includes(keyword);
    });
  }, [fileItems, fileKind, query]);

  const registerVisionProvider = useCallback(
    (
      fn:
        | (() => { page: number; pageCount: number; dataUrl: string } | null)
        | null,
    ) => {
      onRegisterPdfVisionProvider?.(
        fn
          ? () => {
              const result = fn();
              if (!result) return null;
              return { title: activeFile?.name ?? "当前 PDF", ...result };
            }
          : null,
      );
    },
    [activeFile?.name, onRegisterPdfVisionProvider],
  );

  useEffect(() => {
    if (activeFile && activeIsPdf) setSummaryOpen(false);
  }, [activeFile, activeIsPdf]);

  useEffect(() => {
    onRegisterPdfVisionProvider?.(null);
  }, [activeUrl, onRegisterPdfVisionProvider]);

  useEffect(() => {
    let cancelled = false;
    setActiveFile(null);
    setError(null);
    if (!selectedId) {
      setFileItems([]);
      return;
    }

    void (async () => {
      try {
        const list = await listFiles(selectedId);
        if (!cancelled) setFileItems(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "文件列表加载失败");
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
        const stats = await getKnowledgeStats();
        if (!cancelled) setKnowledgeStats(stats);
      } catch {
        if (!cancelled) setKnowledgeStats(null);
      }

      try {
        const review = await getReviewRecommendations(8);
        if (!cancelled) setReviewToday(review.today ?? []);
      } catch {
        if (!cancelled) setReviewToday([]);
      }

      try {
        const graph = await getKnowledgeGraph();
        if (!cancelled) setGraphTree((graph.tree as Record<string, unknown>) ?? null);
      } catch {
        if (!cancelled) setGraphTree(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshFiles(folderId = selectedId) {
    if (!folderId) return;
    const list = await listFiles(folderId);
    if (folderId === selectedId) setFileItems(list);
  }

  async function handleUpload(filesToUpload: FileList | null) {
    if (!filesToUpload?.length || !selectedId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const filesToSave = Array.from(filesToUpload);
      for (const file of filesToSave) {
        await uploadFile({ folderId: selectedId, file });
      }
      await refreshFiles();
      setNotice(`上传成功，${filesToSave.length} 个文件已加入当前资料夹。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!window.confirm("确定删除这个文件吗？")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteFile(fileId);
      if (activeFile?.id === fileId) setActiveFile(null);
      await refreshFiles();
      setNotice("文件已删除。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  function openReportDialog(file: IndexedFileItem, type: PdfReportType) {
    const preferred = folderOptions.find((item) => item.label === recommendedFolderName(type));
    setReportDraft({ file, type });
    setTargetFolderId(preferred?.id ?? selectedId);
    setNewFolderName(recommendedFolderName(type));
    setNewFolderParentId(type === "wrong" || type === "knowledge" ? null : selectedId);
  }

  async function submitReport() {
    if (!reportDraft) return;
    let targetId = targetFolderId || selectedId;
    let targetLabel =
      folderOptions.find((item) => item.id === targetId)?.label ?? recommendedFolderName(reportDraft.type);

    if (newFolderName.trim()) {
      const existing = folderOptions.find(
        (item) => item.label === newFolderName.trim() && item.id === targetFolderId,
      );
      if (!existing && targetFolderId === "__new__") {
        const created = onCreateFolder(newFolderParentId, newFolderName.trim());
        targetId = created.id;
        targetLabel = created.label;
      }
    }

    setActiveFile(reportDraft.file);
    setReportBusy({ fileId: reportDraft.file.id, type: reportDraft.type });
    setError(null);
    setNotice(null);
    setReportDraft(null);
    try {
      const result = await generatePdfReport({
        fileId: reportDraft.file.id,
        reportType: reportDraft.type,
        targetFolderId: targetId,
        targetLabel,
      });
      setFileItems((current) =>
        result.target_folder_id === selectedId
          ? [result.file, ...current.filter((item) => item.id !== result.file.id)]
          : current,
      );
      setActiveFile(result.file);
      await refreshFiles(result.target_folder_id);
      setNotice(`已生成《${result.file.name}》，存放在“${result.target_label}”。`);
      onSelectFolder(result.target_folder_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI PDF 生成失败");
    } finally {
      setReportBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--main-bg)]">
      <header className="lw-hairline-top shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--main-bg)_90%,transparent)] px-6 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              当前资料夹
            </p>
            <h1 className="mt-1 truncate text-[24px] font-black tracking-tight text-[var(--main-fg)]">
              {folderLabel}
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[var(--main-muted)]">
              上传课程资料，预览 PDF，生成错题报告和知识点总结。生成后会自动跳转到存放文件夹。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSummaryOpen((value) => !value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-[12px] font-bold text-[var(--main-fg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
            >
              {summaryOpen ? "收起概览" : "展开概览"}
            </button>
            {canDelete && selectedId ? (
              <button
                type="button"
                onClick={onDeleteCurrent}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-bold text-red-700 transition hover:-translate-y-px hover:bg-red-100"
              >
                删除当前文件夹
              </button>
            ) : null}
          </div>
        </div>

        {summaryOpen ? (
          <div className="lw-reveal mt-4 grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr]">
            <SummaryPanel title="薄弱知识点" icon={<BarChart3 className="h-4 w-4" />}>
              {knowledgeStats?.weak_top5?.length ? (
                <ul className="space-y-2">
                  {knowledgeStats.weak_top5.map((row, index) => (
                    <li key={row.name} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="truncate text-[var(--main-fg)]">
                        {index + 1}. {row.name}
                      </span>
                      <span className="shrink-0 text-[var(--main-muted)]">
                        {row.wrong_count} 次 · 难度 {row.avg_difficulty.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] leading-6 text-[var(--main-muted)]">
                  整理错题后会自动沉淀薄弱知识点。
                </p>
              )}
            </SummaryPanel>

            <SummaryPanel title="今日复习" icon={<RefreshCw className="h-4 w-4" />}>
              {reviewToday.length ? (
                <div className="flex flex-wrap gap-2">
                  {reviewToday.map((name) => (
                    <span
                      key={name}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--main-fg)]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] leading-6 text-[var(--main-muted)]">
                  暂无复习推荐，先上传资料并整理错题。
                </p>
              )}
            </SummaryPanel>

            <SummaryPanel title="知识关系" icon={<FolderOpen className="h-4 w-4" />}>
              {graphTree && Object.keys(graphTree).length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-[12px] font-bold text-[var(--accent)]">
                    查看知识点结构
                  </summary>
                  <div className="mt-3 max-h-[220px] overflow-auto pr-1">
                    <KnowledgeGraphTree data={graphTree} />
                  </div>
                </details>
              ) : (
                <p className="text-[12px] leading-6 text-[var(--main-muted)]">
                  知识图谱会根据错题和报告逐步形成。
                </p>
              )}
            </SummaryPanel>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0">
          {fileListOpen ? (
            <aside className="flex min-h-0 w-[382px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--main-surface)]/90 backdrop-blur-xl">
              <div className="shrink-0 border-b border-[var(--border)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-black tracking-tight text-[var(--main-fg)]">
                      资料列表
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--main-muted)]">
                      {fileItems.length} 个文件 · {filteredFiles.length} 个可见
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFileListOpen(false)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--main-muted)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
                      title="收起资料列表"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!selectedId || busy}
                      onClick={() => inputRef.current?.click()}
                      className="lw-scan inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[12px] font-bold text-white shadow-[0_12px_24px_-14px_var(--accent-glow)] transition hover:-translate-y-px hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      上传
                    </button>
                  </div>
                  <input
                    ref={inputRef}
                    className="hidden"
                    type="file"
                    multiple
                    onChange={(event) => void handleUpload(event.target.files)}
                  />
                </div>

                {error ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                    {error}
                  </div>
                ) : null}
                {notice ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                    {notice}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 text-[13px] text-[var(--main-muted)] shadow-[var(--shadow-sm)] focus-within:border-[var(--accent)]/60 focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
                    <Search className="h-4 w-4" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索文件名或类型"
                      className="min-w-0 flex-1 bg-transparent text-[var(--main-fg)] outline-none placeholder:text-[var(--main-muted)]"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-1 shadow-[var(--shadow-sm)]">
                    {[
                      ["all", "全部"],
                      ["pdf", "PDF"],
                      ["other", "其他"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFileKind(value as "all" | "pdf" | "other")}
                        className={`rounded-md px-2 py-1.5 text-[12px] font-bold transition ${
                          fileKind === value
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--main-muted)] hover:bg-[var(--chip-bg)] hover:text-[var(--main-fg)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lw-scroll-fade min-h-0 flex-1 overflow-auto px-3 py-3">
                {fileItems.length === 0 ? (
                  <EmptyState text="当前文件夹暂无资料，点击上方“上传”开始整理。" />
                ) : filteredFiles.length === 0 ? (
                  <EmptyState text="没有匹配的文件，可以清空搜索或切换筛选条件。" />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {filteredFiles.map((file) => {
                      const active = activeFile?.id === file.id;
                      const generatedReport = isGeneratedReport(file);
                      return (
                        <li key={file.id}>
                          <div
                            className={`rounded-lg border p-3 transition duration-300 ${
                              active
                                ? "lw-active-frame border-[var(--accent)]/35 bg-[var(--accent-soft)] shadow-[var(--shadow-card)]"
                                : "border-transparent bg-[var(--card-bg)] hover:-translate-y-px hover:border-[var(--border)] hover:shadow-[var(--shadow-sm)]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                onClick={() => setActiveFile(file)}
                              >
                                <span className="grid h-11 w-12 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--main-bg)] text-[11px] font-black text-[var(--accent)] shadow-inner">
                                  {fileBadge(file)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-black text-[var(--main-fg)]">
                                    {file.name}
                                  </span>
                                  <span className="mt-1 block truncate text-[11px] text-[var(--main-muted)]">
                                    {formatSize(file.size)} · {formatTime(file.uploadedAt)}
                                  </span>
                                </span>
                              </button>

                              <button
                                type="button"
                                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => void handleDeleteFile(file.id)}
                                title="删除文件"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {isPdfFile(file) && !generatedReport ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <ReportButton
                                  disabled={busy || Boolean(reportBusy)}
                                  active={reportBusy?.fileId === file.id && reportBusy.type === "wrong"}
                                  onClick={() => openReportDialog(file, "wrong")}
                                >
                                  整理错题
                                </ReportButton>
                                <ReportButton
                                  accent
                                  disabled={busy || Boolean(reportBusy)}
                                  active={
                                    reportBusy?.fileId === file.id && reportBusy.type === "knowledge"
                                  }
                                  onClick={() => openReportDialog(file, "knowledge")}
                                >
                                  整理知识点
                                </ReportButton>
                              </div>
                            ) : generatedReport ? (
                              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--main-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--main-muted)]">
                                已生成报告，可直接预览或删除。
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setFileListOpen(true)}
              className="flex w-[46px] shrink-0 flex-col items-center justify-start gap-2 border-r border-[var(--border)] bg-[var(--main-surface)] px-2 py-4 text-[11px] font-semibold text-[var(--main-muted)] transition hover:bg-[var(--card-bg)]"
              title="展开资料列表"
            >
              <PanelLeftOpen className="h-5 w-5" />
              <span className="[writing-mode:vertical-rl]">资料列表</span>
            </button>
          )}

          <section className="flex min-h-0 flex-1 flex-col bg-[var(--main-bg)]">
            {activeFile && activeIsPdf ? (
              <PdfPreview
                url={activeUrl}
                title={activeFile.name}
                onRegisterVisionProvider={registerVisionProvider}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
                <EmptyPreview activeFile={activeFile} files={files} />
              </div>
            )}
          </section>
        </div>
      </div>

      {reportDraft ? (
        <ReportDestinationDialog
          draft={reportDraft}
          folders={folderOptions}
          targetFolderId={targetFolderId}
          newFolderName={newFolderName}
          newFolderParentId={newFolderParentId}
          busy={Boolean(reportBusy)}
          onTargetFolderChange={setTargetFolderId}
          onNewFolderNameChange={setNewFolderName}
          onNewFolderParentChange={setNewFolderParentId}
          onClose={() => setReportDraft(null)}
          onSubmit={() => void submitReport()}
        />
      ) : null}
    </div>
  );
}

function SummaryPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lw-panel rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-black text-[var(--main-fg)]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ReportButton({
  children,
  active,
  accent,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-2 text-[12px] font-black shadow-[var(--shadow-sm)] transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50 ${
        accent
          ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--main-fg)] hover:bg-[var(--chip-bg)]"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {active ? "生成中..." : children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--card-bg)] px-4 py-12 text-center text-[13px] leading-relaxed text-[var(--main-muted)]">
      {text}
    </div>
  );
}

function EmptyPreview({
  activeFile,
  files,
}: {
  activeFile: IndexedFileItem | null;
  files: MockFileItem[];
}) {
  return (
    <>
      <div className="lw-panel grid min-h-[360px] place-items-center rounded-lg border-dashed px-6 py-14 text-center text-[13px] leading-relaxed text-[var(--main-muted)]">
        <div>
          <FileText className="mx-auto mb-4 h-10 w-10 text-[var(--accent)]" />
          <p className="text-[15px] font-black text-[var(--main-fg)]">
            {activeFile ? "暂不支持预览该文件" : "选择一个 PDF 开始阅读"}
          </p>
          <p className="mt-2 max-w-md">
            {activeFile
              ? "当前预览区优先支持 PDF。其他文件可以继续保存在资料库中。"
              : "从左侧资料列表选择 PDF，或上传新的课程资料。"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-[13px] font-black text-[var(--main-fg)]">示例资料卡片</p>
        {files.length === 0 ? (
          <EmptyState text="当前文件夹暂无示例资料。" />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {files.map((file) => (
              <li key={file.id}>
                <div className="flex h-full flex-col rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:shadow-[var(--shadow-card)]">
                  <span className="mb-3 inline-flex w-fit rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-black text-[var(--accent)]">
                    {readableKindLabel(file.kind)}
                  </span>
                  <span className="line-clamp-2 text-[15px] font-black leading-snug text-[var(--main-fg)]">
                    {file.title}
                  </span>
                  <span className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-[var(--main-muted)]">
                    {file.preview}
                  </span>
                  <span className="mt-3 text-[12px] text-[var(--main-muted)]">
                    更新于 {file.updatedAt}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SmallStep icon={<UploadCloud className="h-4 w-4" />} title="上传资料" />
        <SmallStep icon={<BookOpenCheck className="h-4 w-4" />} title="阅读与标记" />
        <SmallStep icon={<Sparkles className="h-4 w-4" />} title="AI 生成报告" />
      </div>
    </>
  );
}

function SmallStep({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 text-[12px] font-bold text-[var(--main-fg)] shadow-[var(--shadow-sm)]">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      {title}
    </div>
  );
}

function ReportDestinationDialog({
  draft,
  folders,
  targetFolderId,
  newFolderName,
  newFolderParentId,
  busy,
  onTargetFolderChange,
  onNewFolderNameChange,
  onNewFolderParentChange,
  onClose,
  onSubmit,
}: {
  draft: NonNullable<ReportDraft>;
  folders: FolderOption[];
  targetFolderId: string;
  newFolderName: string;
  newFolderParentId: string | null;
  busy: boolean;
  onTargetFolderChange: (value: string) => void;
  onNewFolderNameChange: (value: string) => void;
  onNewFolderParentChange: (value: string | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const title = draft.type === "wrong" ? "整理错题" : "整理知识点";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 backdrop-blur-sm">
      <div className="lw-panel w-full max-w-[520px] rounded-lg p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              生成报告
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--main-fg)]">{title}</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--main-muted)]">
              请选择报告生成后放在哪个文件夹。你也可以在已有文件夹下面新建一个目录。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--main-muted)] hover:bg-[var(--chip-bg)]"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-3 py-3">
          <p className="truncate text-[13px] font-bold text-[var(--main-fg)]">{draft.file.name}</p>
          <p className="mt-1 text-[12px] text-[var(--main-muted)]">
            {formatSize(draft.file.size)} · {formatTime(draft.file.uploadedAt)}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[12px] font-bold text-[var(--main-fg)]">存放到</span>
            <select
              value={targetFolderId}
              onChange={(event) => onTargetFolderChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 text-[13px] text-[var(--main-fg)] outline-none focus:border-[var(--accent)]"
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"　".repeat(folder.depth)}
                  {folder.label}
                </option>
              ))}
              <option value="__new__">+ 新建文件夹</option>
            </select>
          </label>

          {targetFolderId === "__new__" ? (
            <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] p-3">
              <label className="block">
                <span className="text-[12px] font-bold text-[var(--main-fg)]">新文件夹名称</span>
                <input
                  value={newFolderName}
                  onChange={(event) => onNewFolderNameChange(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-[var(--main-fg)]">创建在</span>
                <select
                  value={newFolderParentId ?? ""}
                  onChange={(event) => onNewFolderParentChange(event.target.value || null)}
                  className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">根目录</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {"　".repeat(folder.depth)}
                      {folder.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-[13px] font-bold text-[var(--main-fg)] hover:bg-[var(--chip-bg)]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || (targetFolderId === "__new__" && !newFolderName.trim())}
            onClick={onSubmit}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-[13px] font-bold text-white shadow-[0_14px_28px_-18px_var(--accent-glow)] disabled:opacity-50"
          >
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
}
