"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LibraryBig, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DEFAULT_PERSISTED_DOCUMENT } from "@/data/defaultFolderState";
import { mockFilesByFolderId } from "@/data/mockFolders";
import {
  addChild,
  collectSubtreeIds,
  findNode,
  findParentId,
  firstIdDfsOrEmpty,
  removeNode,
  renameNode,
} from "@/lib/folderTree";
import { fetchFolderState, saveFolderState } from "@/lib/foldersApi";
import { normalizePersistedState } from "@/lib/normalizeFolderState";
import type { TreeNode } from "@/types/folder";
import { AgentPanel } from "./AgentPanel";
import { MainContent } from "./MainContent";
import { SidebarTree } from "./SidebarTree";

const SIDEBAR_NAV = [
  { href: "/home", label: "首页" },
  { href: "/dashboard", label: "看板" },
  { href: "/settings", label: "设置" },
] as const;

type PdfVisionSnapshot = {
  title: string;
  page: number;
  pageCount: number;
  dataUrl: string;
};

function findLabel(nodes: TreeNode[], id: string): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.label;
    if (node.children?.length) {
      const inner = findLabel(node.children, id);
      if (inner) return inner;
    }
  }
  return null;
}

function commitTreeState(tree: TreeNode[], selectedId: string, expandedFolderIds: string[]) {
  void saveFolderState({
    version: 1,
    tree,
    selectedFolderId: selectedId,
    expandedFolderIds,
  }).catch(() => {});
}

export function AppShell() {
  const pathname = usePathname() || "";
  const [tree, setTree] = useState<TreeNode[]>(DEFAULT_PERSISTED_DOCUMENT.tree);
  const [selectedId, setSelectedId] = useState(DEFAULT_PERSISTED_DOCUMENT.selectedFolderId);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>(
    DEFAULT_PERSISTED_DOCUMENT.expandedFolderIds,
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pdfVisionProvider, setPdfVisionProvider] = useState<
    (() => PdfVisionSnapshot | null) | null
  >(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [agentCollapsed, setAgentCollapsed] = useState(false);

  const registerPdfVisionProvider = useCallback((fn: (() => PdfVisionSnapshot | null) | null) => {
    setPdfVisionProvider(() => fn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await fetchFolderState();
        if (cancelled) return;
        const doc = normalizePersistedState(raw);
        setTree(doc.tree);
        setSelectedId(doc.selectedFolderId);
        setExpandedFolderIds(doc.expandedFolderIds);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "目录加载失败");
        setTree(DEFAULT_PERSISTED_DOCUMENT.tree);
        setSelectedId(DEFAULT_PERSISTED_DOCUMENT.selectedFolderId);
        setExpandedFolderIds(DEFAULT_PERSISTED_DOCUMENT.expandedFolderIds);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      commitTreeState(tree, selectedId, expandedFolderIds);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [tree, selectedId, expandedFolderIds, hydrated]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const createFolder = useCallback(
    (parentId: string | null, label = "新建文件夹") => {
      const node: TreeNode = {
        id: crypto.randomUUID(),
        label,
      };
      let nextTree: TreeNode[] = [];
      setTree((prev) => {
        nextTree = addChild(prev, parentId, node);
        return nextTree;
      });
      setSelectedId(node.id);
      setExpandedFolderIds((prev) => {
        const nextExpanded = parentId && !prev.includes(parentId) ? [...prev, parentId] : prev;
        queueMicrotask(() => commitTreeState(nextTree, node.id, nextExpanded));
        return nextExpanded;
      });
      return node;
    },
    [],
  );

  const handleAddChild = useCallback(
    (parentId: string | null) => {
      createFolder(parentId);
    },
    [createFolder],
  );

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm("确定删除该文件夹及其全部子文件夹吗？")) return;

    setTree((prev) => {
      const target = findNode(prev, id);
      const removeSet = new Set(target ? collectSubtreeIds(target) : []);
      const parentBefore = findParentId(prev, id);
      const nextTree = removeNode(prev, id);

      queueMicrotask(() => {
        setSelectedId((current) => {
          if (!removeSet.has(current)) return current;
          if (typeof parentBefore === "string" && findNode(nextTree, parentBefore)) {
            return parentBefore;
          }
          return firstIdDfsOrEmpty(nextTree);
        });
        setExpandedFolderIds((prevExpanded) =>
          prevExpanded.filter((item) => !removeSet.has(item)),
        );
      });

      return nextTree;
    });
  }, []);

  const handleStartRename = useCallback(
    (id: string, currentLabel: string) => {
      if (editingId !== null && editingId !== id) {
        const trimmed = renameDraft.trim() || "未命名";
        setTree((current) => renameNode(current, editingId, trimmed));
      }
      setEditingId(id);
      setRenameDraft(currentLabel);
    },
    [editingId, renameDraft],
  );

  const handleCommitRename = useCallback(() => {
    if (editingId === null) return;
    const trimmed = renameDraft.trim() || "未命名";
    setTree((current) => renameNode(current, editingId, trimmed));
    setEditingId(null);
    setRenameDraft("");
  }, [editingId, renameDraft]);

  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setRenameDraft("");
  }, []);

  const folderLabel = findLabel(tree, selectedId) ?? "未选择";
  const files = mockFilesByFolderId[selectedId] ?? [];

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-transparent text-[var(--main-fg)]">
      {!leftCollapsed ? (
        <aside className="flex w-[292px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)] backdrop-blur-xl">
          <div className="lw-hairline-top shrink-0 border-b border-[var(--border)] px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]">
                <Image
                  src="/learningweb-mark.png"
                  alt="LearningWeb"
                  width={34}
                  height={34}
                  className="h-8 w-8 object-contain"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black tracking-tight text-[var(--sidebar-fg)]">
                  LearningWeb
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-[var(--sidebar-muted)]">
                  <LibraryBig className="h-3.5 w-3.5 text-[var(--accent)]" />
                  资料库 · 学习闭环
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {SIDEBAR_NAV.map(({ href, label }) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-sm)]"
                            : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)]"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeftCollapsed(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--sidebar-fg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
                title="收起文件夹栏"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--chip-bg)]/55 px-3 py-2 text-[11px] leading-5 text-[var(--sidebar-muted)] shadow-inner">
              {hydrated
                ? loadError
                  ? "离线目录 · API 未连接"
                  : "已连接本地资料目录"
                : "正在加载目录..."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
            <SidebarTree
              nodes={tree}
              selectedId={selectedId}
              expandedFolderIds={expandedFolderIds}
              onSelect={setSelectedId}
              onToggleExpand={toggleExpand}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              editingId={editingId}
              renameDraft={renameDraft}
              onRenameDraftChange={setRenameDraft}
              onStartRename={handleStartRename}
              onCommitRename={handleCommitRename}
              onCancelRename={handleCancelRename}
              disabled={!hydrated}
            />
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setLeftCollapsed(false)}
          className="flex w-[48px] shrink-0 flex-col items-center justify-start gap-2 border-r border-[var(--border)] bg-[var(--sidebar-surface)] px-2 py-4 text-[11px] font-semibold text-[var(--sidebar-fg)] transition hover:bg-[var(--card-bg)]"
          title="展开文件夹栏"
        >
          <PanelLeftOpen className="h-5 w-5" />
          <span className="[writing-mode:vertical-rl]">文件夹</span>
        </button>
      )}

      <MainContent
        folderLabel={folderLabel}
        files={files}
        selectedId={selectedId}
        folderTree={tree}
        onCreateFolder={createFolder}
        onSelectFolder={setSelectedId}
        onDeleteCurrent={() => handleDelete(selectedId)}
        canDelete={hydrated && Boolean(selectedId) && tree.length > 0}
        onRegisterPdfVisionProvider={registerPdfVisionProvider}
      />

      {!agentCollapsed ? (
        <AgentPanel
          pdfVisionProvider={pdfVisionProvider}
          onToggleCollapse={() => setAgentCollapsed(true)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAgentCollapsed(false)}
          className="flex w-[48px] shrink-0 flex-col items-center justify-start gap-2 border-l border-[var(--agent-border)] bg-[var(--agent-bg)] px-2 py-4 text-[11px] font-semibold text-[var(--agent-fg)] transition hover:brightness-[1.02]"
          title="展开 AI 助手"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="[writing-mode:vertical-rl]">AI 助手</span>
        </button>
      )}
    </div>
  );
}
