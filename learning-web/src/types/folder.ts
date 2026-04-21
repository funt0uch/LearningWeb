export type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
};

export type MockFileItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  kind: "note" | "pdf" | "sheet";
};

/** 与 E:\\LearningWeb\\data\\folders.json 对齐 */
export type PersistedFolderDocument = {
  version: number;
  tree: TreeNode[];
  selectedFolderId: string;
  expandedFolderIds: string[];
};

/** 与 E:\\LearningWeb\\data\\files_index.json 的条目字段对齐 */
export type IndexedFileItem = {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: string;
  folderId: string;
};

export type WrongQuestionItemDto = {
  question: string;
  answer: string;
  knowledge_point: string;
  analysis: string;
  difficulty: "easy" | "medium" | "hard";
  source_page: number;
  related_image_paths: string[];
  item_id?: string;
};

export type KnowledgePointRow = {
  name: string;
  wrong_count: number;
  avg_difficulty: number;
  last_wrong_at: string | null;
};

export type KnowledgeStatsResponse = {
  counts: Record<string, number>;
  points: KnowledgePointRow[];
  weak_top5: KnowledgePointRow[];
  generated_at: string;
};

export type WrongItemDetailResponse = {
  ok: boolean;
  item: WrongQuestionItemDto & {
    source_file?: string;
    _pdf_path?: string;
  };
};

export type WrongQuestionsFromPdfResponse = {
  ok: boolean;
  schema_version: number;
  summary: string;
  items: (WrongQuestionItemDto & { item_id?: string })[];
  saved_path: string | null;
  retries_used: number;
  degraded: boolean;
  vision_used: boolean;
  last_error: string | null;
  attempt_log: string[];
};
