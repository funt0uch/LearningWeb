"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { ChevronRight, FolderPlus, Pencil, Trash2 } from "lucide-react";
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
  onRenameDraftChange: (value: string) => void;
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
        className="min-w-0 flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--card-bg)] px-2 py-1 text-[13px] text-[var(--sidebar-fg)] outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
        value={renameDraft}
        onChange={(event) => onRenameDraftChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommitRename();
          }
          if (event.key === "Escape") {
            event.preventDefault();
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
      className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] leading-5 transition disabled:opacity-50 ${
        selected
          ? "bg-[var(--sidebar-active-bg)] font-bold text-[var(--sidebar-active-fg)] shadow-[inset_2px_0_0_var(--accent)]"
          : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:pl-2.5"
      }`}
    >
      {label}
    </button>
  );
}

function TreeRows({ nodes, depth, ...rest }: SidebarTreeProps & { depth: number }) {
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
            <div className="flex items-center rounded-md pr-0.5" style={{ paddingLeft: 6 + depth * 14 }}>
              {hasChildren ? (
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded p-0.5 text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] disabled:opacity-40"
                  aria-expanded={open}
                  aria-label={open ? "收起" : "展开"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(node.id);
                  }}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
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
                  <div className="flex shrink-0 items-center gap-0.5 pr-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                    <IconButton
                      disabled={disabled}
                      title="新建子文件夹"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddChild(node.id);
                      }}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      disabled={disabled}
                      title="重命名"
                      onClick={(event) => {
                        event.stopPropagation();
                        onStartRename(node.id, node.label);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      disabled={disabled}
                      title="删除"
                      danger
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(node.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            </div>

            {hasChildren && open && node.children ? (
              <TreeRows nodes={node.children} depth={depth + 1} {...rest} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function IconButton({
  title,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={`rounded p-1 text-[var(--sidebar-muted)] disabled:opacity-40 ${
        danger
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)]"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SidebarTree(props: Omit<SidebarTreeProps, "depth">) {
  const { onAddChild, disabled } = props;

  return (
    <nav className="flex flex-col gap-3" aria-label="资料文件夹">
      <div className="flex items-center gap-2 px-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">
          文件夹
        </p>
      </div>
      <div className="px-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAddChild(null)}
          className="lw-scan flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--card-bg)] px-2 py-2 text-[12px] font-semibold text-[var(--accent)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:border-[var(--accent)]/50 hover:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          新建文件夹
        </button>
      </div>
      <TreeRows {...props} depth={0} />
    </nav>
  );
}
