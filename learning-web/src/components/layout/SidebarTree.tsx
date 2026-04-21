"use client";

import { useEffect, useRef } from "react";
import type { TreeNode } from "@/types/folder";

export type SidebarTreeProps = {
  nodes: TreeNode[];
  selectedId: string;
  expandedFolderIds: string[];
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onStartRename: (id: string, currentLabel: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  disabled?: boolean;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--sidebar-muted)]"
      aria-hidden
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      >
        <path
          d="M3 1.5L7 5L3 8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.75a.75.75 0 01.75.75v4.75h4.75a.75.75 0 010 1.5H8.75v4.75a.75.75 0 01-1.5 0V8.75H2.5a.75.75 0 010-1.5h4.75V2.5A.75.75 0 018 1.75z"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.74l1.92 1.92 1.727-1.727a.25.25 0 000-.354l-1.086-1.086a.25.25 0 00-.354 0zM9.75 5.07L4.75 10.07V11h1.06l5-5-1.06-1.06z"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  );
}

function FolderLabelOrInput({
  isEditing,
  label,
  renameDraft,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  selected,
  disabled,
  onSelectFolder,
}: {
  isEditing: boolean;
  label: string;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  selected: boolean;
  disabled?: boolean;
  onSelectFolder: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-md border border-[var(--border-strong)] bg-white px-2 py-1 text-[13px] text-[var(--sidebar-fg)] outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
        value={renameDraft}
        onChange={(e) => onRenameDraftChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommitRename();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancelRename();
          }
        }}
        onBlur={() => onCommitRename()}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelectFolder}
      className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] leading-5 transition-colors disabled:opacity-50 ${
        selected
          ? "bg-[var(--sidebar-active-bg)] font-medium text-[var(--sidebar-active-fg)]"
          : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)]"
      }`}
    >
      {label}
    </button>
  );
}

function TreeRows({
  nodes,
  depth,
  ...rest
}: SidebarTreeProps & { depth: number }) {
  const {
    selectedId,
    expandedFolderIds,
    onSelect,
    onToggleExpand,
    onAddChild,
    onDelete,
    editingId,
    renameDraft,
    onRenameDraftChange,
    onStartRename,
    onCommitRename,
    onCancelRename,
    disabled,
  } = rest;

  return (
    <ul className="flex flex-col gap-px">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const open = hasChildren && expandedFolderIds.includes(node.id);
        const selected = selectedId === node.id;
        const isEditing = editingId === node.id;

        return (
          <li key={node.id} className="group/row relative">
            <div
              className="flex items-center rounded-md pr-0.5"
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded p-0.5 hover:bg-[var(--sidebar-hover)] disabled:opacity-40"
                  aria-expanded={open}
                  aria-label={open ? "收起" : "展开"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.id);
                  }}
                >
                  <Chevron open={open} />
                </button>
              ) : (
                <span className="inline-block w-5 shrink-0" />
              )}
              <div className="flex min-w-0 flex-1 items-center gap-0.5">
                <FolderLabelOrInput
                  isEditing={isEditing}
                  label={node.label}
                  renameDraft={renameDraft}
                  onRenameDraftChange={onRenameDraftChange}
                  onCommitRename={onCommitRename}
                  onCancelRename={onCancelRename}
                  selected={selected}
                  disabled={disabled}
                  onSelectFolder={() => onSelect(node.id)}
                />
                {!isEditing ? (
                  <div
                    className="flex shrink-0 items-center gap-0.5 pr-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100"
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      title="新建子文件夹"
                      className="rounded p-1 text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(node.id);
                      }}
                    >
                      <IconPlus />
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      title="重命名"
                      className="rounded p-1 text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartRename(node.id, node.label);
                      }}
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      title="删除"
                      className="rounded p-1 text-[var(--sidebar-muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(node.id);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {hasChildren && open && node.children ? (
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                {...rest}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarTree(props: Omit<SidebarTreeProps, "depth">) {
  const { onAddChild, disabled } = props;

  return (
    <nav className="flex flex-col gap-3" aria-label="资料夹">
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
          资料库
        </p>
      </div>
      <div className="px-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAddChild(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--main-bg)] px-2 py-1.5 text-[12px] font-medium text-[var(--sidebar-fg)] shadow-sm hover:bg-[var(--sidebar-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconPlus />
          新建文件夹
        </button>
      </div>
      <TreeRows {...props} depth={0} />
    </nav>
  );
}
