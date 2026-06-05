import type { PersistedFolderDocument } from "@/types/folder";
import { apiBase } from "./apiBase";

export async function fetchFolderState(): Promise<PersistedFolderDocument> {
  const res = await fetch(`${apiBase()}/api/folders-state`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`加载目录失败：HTTP ${res.status}`);
  }
  return (await res.json()) as PersistedFolderDocument;
}

export async function saveFolderState(doc: PersistedFolderDocument): Promise<void> {
  const res = await fetch(`${apiBase()}/api/folders-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    throw new Error(`保存目录失败：HTTP ${res.status}`);
  }
}
