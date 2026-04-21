import type { PersistedFolderDocument, TreeNode } from "@/types/folder";

/** 与后端 DEFAULT_STATE / data/folders.json 初始结构一致（离线回退用） */
export const DEFAULT_FOLDER_TREE: TreeNode[] = [
  {
    id: "math",
    label: "数学",
    children: [
      { id: "calculus", label: "高数" },
      { id: "linear", label: "线代" },
    ],
  },
  { id: "exams", label: "考试试卷" },
  { id: "mistakes", label: "错题整理" },
];

export const DEFAULT_PERSISTED_DOCUMENT: PersistedFolderDocument = {
  version: 1,
  tree: DEFAULT_FOLDER_TREE,
  selectedFolderId: "calculus",
  expandedFolderIds: ["math"],
};
