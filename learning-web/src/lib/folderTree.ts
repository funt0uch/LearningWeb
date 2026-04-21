import type { TreeNode } from "@/types/folder";

export function collectAllIds(nodes: TreeNode[]): Set<string> {
  const s = new Set<string>();
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      s.add(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return s;
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

/** 未找到: false；在根层: null；否则为父节点 id */
export function findParentId(
  nodes: TreeNode[],
  targetId: string,
  parent: string | null = null,
): string | null | false {
  for (const n of nodes) {
    if (n.id === targetId) return parent;
    if (n.children?.length) {
      const r = findParentId(n.children, targetId, n.id);
      if (r !== false) return r;
    }
  }
  return false;
}

export function collectSubtreeIds(node: TreeNode): string[] {
  const ids: string[] = [node.id];
  if (node.children?.length) {
    for (const c of node.children) ids.push(...collectSubtreeIds(c));
  }
  return ids;
}

/** 删除以 id 为根的整棵子树（含 id 自身） */
export function removeNode(nodes: TreeNode[], id: string): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    if (n.id === id) continue;
    const children = n.children?.length
      ? removeNode(n.children, id)
      : undefined;
    out.push({
      ...n,
      children: children?.length ? children : undefined,
    });
  }
  return out;
}

export function addChild(
  nodes: TreeNode[],
  parentId: string | null,
  child: TreeNode,
): TreeNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId) {
      const nextChildren = [...(n.children ?? []), child];
      return { ...n, children: nextChildren };
    }
    if (n.children?.length) {
      return { ...n, children: addChild(n.children, parentId, child) };
    }
    return n;
  });
}

export function renameNode(
  nodes: TreeNode[],
  id: string,
  label: string,
): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, label };
    if (n.children?.length) {
      return { ...n, children: renameNode(n.children, id, label) };
    }
    return n;
  });
}

/** 深度优先第一个节点 id，空树返回 "" */
export function firstIdDfsOrEmpty(nodes: TreeNode[]): string {
  if (!nodes.length) return "";
  const head = nodes[0];
  if (head.children?.length) {
    const inner = firstIdDfsOrEmpty(head.children);
    return inner || head.id;
  }
  return head.id;
}
