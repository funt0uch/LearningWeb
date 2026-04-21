import type { PersistedFolderDocument } from "@/types/folder";
import { collectAllIds, firstIdDfsOrEmpty } from "./folderTree";

export function normalizePersistedState(
  raw: PersistedFolderDocument,
): PersistedFolderDocument {
  const all = collectAllIds(raw.tree);
  const selected = all.has(raw.selectedFolderId)
    ? raw.selectedFolderId
    : firstIdDfsOrEmpty(raw.tree);
  const expanded = raw.expandedFolderIds.filter((id) => all.has(id));
  return {
    version: raw.version,
    tree: raw.tree,
    selectedFolderId: selected,
    expandedFolderIds: expanded,
  };
}
