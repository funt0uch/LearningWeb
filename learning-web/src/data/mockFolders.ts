import type { MockFileItem } from "@/types/folder";

/** 中间区卡片 mock（第三阶段可改为 API） */
export const mockFilesByFolderId: Record<string, MockFileItem[]> = {
  math: [
    {
      id: "m1",
      title: "数学 · 总览",
      preview: "章节索引与复习计划草稿。",
      updatedAt: "今天 09:12",
      kind: "note",
    },
  ],
  calculus: [
    {
      id: "c1",
      title: "极限与连续 · 笔记",
      preview: "ε-δ 定义要点与常见题型。",
      updatedAt: "昨天 18:40",
      kind: "note",
    },
    {
      id: "c2",
      title: "导数应用 · 习题集",
      preview: "第 3 章课后题整理。",
      updatedAt: "3 天前",
      kind: "sheet",
    },
  ],
  linear: [
    {
      id: "l1",
      title: "矩阵运算速查",
      preview: "行变换与秩的判定流程图。",
      updatedAt: "上周",
      kind: "note",
    },
  ],
  exams: [
    {
      id: "e1",
      title: "2025 期中试卷（扫描）",
      preview: "已 OCR，待标注错题。",
      updatedAt: "周一",
      kind: "pdf",
    },
    {
      id: "e2",
      title: "模拟卷 A",
      preview: "限时 120 分钟。",
      updatedAt: "上周",
      kind: "pdf",
    },
  ],
  mistakes: [
    {
      id: "x1",
      title: "二重积分 · 易错点",
      preview: "极坐标换元忘记乘 r。",
      updatedAt: "今天 11:05",
      kind: "note",
    },
  ],
};
