"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";

function findLabel(nodes: TreeNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.label;
    if (n.children?.length) {
      const inner = findLabel(n.children, id);
      if (inner) return inner;
    }
  }
  return null;
}

export function AppShell() {
  const [tree, setTree] = useState<TreeNode[]>(DEFAULT_PERSISTED_DOCUMENT.tree);
  const [selectedId, setSelectedId] = useState(
    DEFAULT_PERSISTED_DOCUMENT.selectedFolderId,
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>(
    DEFAULT_PERSISTED_DOCUMENT.expandedFolderIds,
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pdfVisionProvider, setPdfVisionProvider] = useState<
    (() => { title: string; page: number; pageCount: number; dataUrl: string } | null) | null
  >(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [agentCollapsed, setAgentCollapsed] = useState(false);

  // 重要：setState 接收 function 会被当成 updater 调用，这里用 () => fn 存“函数值”
  const registerPdfVisionProvider = useCallback(
    (
      fn:
        | (() => { title: string; page: number; pageCount: number; dataUrl: string } | null)
        | null,
    ) => {
      setPdfVisionProvider(() => fn);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await fetchFolderState();
        if (cancelled) return;
        const doc = normalizePersistedState(raw);
        setTree(doc.tree);
        setSelectedId(doc.selectedFolderId);
        setExpandedFolderIds(doc.expandedFolderIds);
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "加载失败");
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
    const t = window.setTimeout(() => {
      void saveFolderState({
        version: 1,
        tree,
        selectedFolderId: selectedId,
        expandedFolderIds,
      }).catch(() => {});
    }, 450);
    return () => window.clearTimeout(t);
  }, [tree, selectedId, expandedFolderIds, hydrated]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleAddChild = useCallback((parentId: string | null) => {
    const node: TreeNode = {
      id: crypto.randomUUID(),
      label: "新建文件夹",
    };
    setTree((prev) => addChild(prev, parentId, node));
    setSelectedId(node.id);
    if (parentId) {
      setExpandedFolderIds((prev) =>
        prev.includes(parentId) ? prev : [...prev, parentId],
      );
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm("确定删除该文件夹及其全部子文件夹？")) return;

    setTree((prev) => {
      const target = findNode(prev, id);
      const removeSet = new Set(
        target ? collectSubtreeIds(target) : [],
      );
      const parentBefore = findParentId(prev, id);
      const nextTree = removeNode(prev, id);

      queueMicrotask(() => {
        setSelectedId((currentSel) => {
          if (!removeSet.has(currentSel)) return currentSel;
          if (
            typeof parentBefore === "string" &&
            findNode(nextTree, parentBefore)
          ) {
            return parentBefore;
          }
          return firstIdDfsOrEmpty(nextTree);
        });
        setExpandedFolderIds((exp) =>
          exp.filter((x) => !removeSet.has(x)),
        );
      });

      return nextTree;
    });
  }, []);

  const handleStartRename = useCallback(
    (id: string, currentLabel: string) => {
      if (editingId !== null && editingId !== id) {
        const trimmed = renameDraft.trim() || "未命名";
        setTree((t) => renameNode(t, editingId, trimmed));
      }
      setEditingId(id);
      setRenameDraft(currentLabel);
    },
    [editingId, renameDraft],
  );

  const handleCommitRename = useCallback(() => {
    if (editingId === null) return;
    const id = editingId;
    const trimmed = renameDraft.trim() || "未命名";
    setTree((t) => renameNode(t, id, trimmed));
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
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--shell-bg)] text-[var(--main-fg)]">
      {!leftCollapsed ? (
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-3">
          <div className="flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[14px] font-bold text-[var(--accent)]">
              L
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[var(--sidebar-fg)]">
                学习资料库
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                <a href="/home" className="text-[var(--accent)] hover:underline">
                  首页
                </a>
                <a href="/dashboard" className="text-[var(--accent)] hover:underline">
                  数据看板
                </a>
                <a href="/settings" className="text-[var(--accent)] hover:underline">
                  设置
                </a>
              </div>
              <p className="truncate text-[11px] text-[var(--sidebar-muted)]">
                {hydrated
                  ? loadError
                    ? "离线默认目录 · API 未连接"
                    : "目录 · E:\\LearningWeb\\data\\folders.json"
                  : "正在加载目录…"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--sidebar-fg)] shadow-sm transition hover:bg-[var(--chip-bg)]"
              title="收起文件夹栏"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
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
          className="flex w-[46px] shrink-0 flex-col items-center justify-start gap-2 border-r border-[var(--border)] bg-[var(--sidebar-surface)] px-2 py-3 text-[11px] text-[var(--sidebar-fg)] hover:bg-white/60"
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
          className="flex w-[46px] shrink-0 flex-col items-center justify-start gap-2 border-l border-[var(--agent-border)] bg-gradient-to-b from-[#f6f8fc] via-[var(--agent-bg)] to-[#eef2fa] px-2 py-3 text-[11px] text-[var(--agent-fg)] hover:bg-white/60"
          title="展开 AI 助手"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="[writing-mode:vertical-rl]">AI</span>
        </button>
      )}
    </div>
  );
}
