import type {
  IndexedFileItem,
  KnowledgeStatsResponse,
  PdfReportResponse,
  PdfReportType,
  WrongItemDetailResponse,
  WrongQuestionsFromPdfResponse,
} from "@/types/folder";
import { apiBase } from "./apiBase";

export async function listFiles(folderId: string): Promise<IndexedFileItem[]> {
  const res = await fetch(`${apiBase()}/api/files/${encodeURIComponent(folderId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`获取文件列表失败：HTTP ${res.status}`);
  return (await res.json()) as IndexedFileItem[];
}

export async function uploadFile(opts: {
  folderId: string;
  file: File;
}): Promise<IndexedFileItem> {
  const fd = new FormData();
  fd.append("folder_id", opts.folderId);
  fd.append("file", opts.file);

  const res = await fetch(`${apiBase()}/api/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`上传失败：HTTP ${res.status}`);
  return (await res.json()) as IndexedFileItem;
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/file/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`删除失败：HTTP ${res.status}`);
}

export function fileDownloadUrl(fileId: string): string {
  return `${apiBase()}/api/file/${encodeURIComponent(fileId)}`;
}

export async function wrongQuestionsFromPdf(
  fileId: string,
): Promise<WrongQuestionsFromPdfResponse> {
  const res = await fetch(`${apiBase()}/api/tasks/wrong-questions/from-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`错题整理失败：HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as WrongQuestionsFromPdfResponse;
}

export async function generatePdfReport(opts: {
  fileId: string;
  reportType: PdfReportType;
  targetFolderId?: string;
  targetLabel?: string;
}): Promise<PdfReportResponse> {
  const res = await fetch(`${apiBase()}/api/tasks/pdf-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_id: opts.fileId,
      report_type: opts.reportType,
      target_folder_id: opts.targetFolderId,
      target_label: opts.targetLabel,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI PDF 生成失败：HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as PdfReportResponse;
}

export async function postChat(opts: {
  message: string;
  mode?: "explain" | "summarize" | "similar" | "free";
  image_urls?: string[];
}): Promise<{ ok: boolean; reply: string; mode?: string }> {
  const res = await fetch(`${apiBase()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: opts.message,
      mode: opts.mode,
      image_urls: opts.image_urls,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`对话失败：HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as { ok: boolean; reply: string; mode?: string };
}

export async function getKnowledgeStats(): Promise<KnowledgeStatsResponse> {
  const res = await fetch(`${apiBase()}/api/knowledge/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`统计加载失败：HTTP ${res.status}`);
  return (await res.json()) as KnowledgeStatsResponse;
}

export async function getWrongItem(itemId: string): Promise<WrongItemDetailResponse> {
  const res = await fetch(`${apiBase()}/api/wrong-items/${encodeURIComponent(itemId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`题目未找到：HTTP ${res.status}`);
  return (await res.json()) as WrongItemDetailResponse;
}
