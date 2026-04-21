import { apiBase } from "./apiBase";

export type ReviewRecommendResponse = {
  ok: boolean;
  today: string[];
  scored: {
    knowledge_point: string;
    score: number;
    wrong_count: number;
    avg_difficulty: number;
    last_wrong_at: string | null;
    days_since_wrong: number;
  }[];
  weak_top5_from_stats: string[];
  generated_at?: string;
  reason?: string;
};

export async function getReviewRecommendations(
  topN = 8,
): Promise<ReviewRecommendResponse> {
  const res = await fetch(
    `${apiBase()}/api/review/recommendations?top_n=${topN}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`review: HTTP ${res.status}`);
  return (await res.json()) as ReviewRecommendResponse;
}

export type KnowledgeGraphResponse = {
  ok: boolean;
  tree: Record<string, unknown>;
  flat_labels: string[];
  stats_generated_at?: string;
};

export async function getKnowledgeGraph(): Promise<KnowledgeGraphResponse> {
  const res = await fetch(`${apiBase()}/api/knowledge/graph`, { cache: "no-store" });
  if (!res.ok) throw new Error(`graph: HTTP ${res.status}`);
  return (await res.json()) as KnowledgeGraphResponse;
}

export type AppSettings = {
  version: number;
  theme: string;
  ocr_preference: boolean;
  learning_prefs: { daily_goal_minutes?: number; review_reminder?: boolean };
  ui: { show_knowledge_graph?: boolean; weak_top_n?: number };
  runtime?: { api_key_configured: boolean; ocr_runtime_enabled: boolean };
};

export async function getSettings(): Promise<{ ok: boolean; settings: AppSettings }> {
  const res = await fetch(`${apiBase()}/api/settings`, { cache: "no-store" });
  if (!res.ok) throw new Error(`settings: HTTP ${res.status}`);
  return (await res.json()) as { ok: boolean; settings: AppSettings };
}

export async function putSettings(
  patch: Partial<Pick<AppSettings, "theme" | "ocr_preference" | "learning_prefs" | "ui">>,
): Promise<{ ok: boolean; settings: AppSettings }> {
  const res = await fetch(`${apiBase()}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`settings save: HTTP ${res.status}`);
  return (await res.json()) as { ok: boolean; settings: AppSettings };
}

export async function postPracticeGenerate(itemId: string): Promise<{
  ok: boolean;
  practice_id: string;
  stem: string;
  knowledge_point: string;
}> {
  const res = await fetch(`${apiBase()}/api/practice/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`练习生成失败：${t}`);
  }
  return (await res.json()) as {
    ok: boolean;
    practice_id: string;
    stem: string;
    knowledge_point: string;
  };
}

export type DashboardOverview = {
  ok?: boolean;
  weekly_study_minutes: number;
  daily_study_trend: { day: string; minutes: number }[];
  cumulative_wrong_total: number;
  knowledge_bar: { name: string; count: number }[];
  knowledge_pie: { name: string; value: number; full?: string }[];
  review_engagement_percent: number;
  practice_accuracy_percent: number | null;
  practice_samples: number;
  week_activity: { views: number; chats: number };
  generated_at?: string;
};

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await fetch(`${apiBase()}/api/dashboard/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`dashboard: HTTP ${res.status}`);
  return (await res.json()) as DashboardOverview;
}

export async function getWeeklyReport(): Promise<{
  ok: boolean;
  report: string;
  generated_at: string;
  metrics?: Record<string, unknown>;
}> {
  const res = await fetch(`${apiBase()}/api/reports/weekly`, { cache: "no-store" });
  if (!res.ok) throw new Error(`weekly: HTTP ${res.status}`);
  return (await res.json()) as {
    ok: boolean;
    report: string;
    generated_at: string;
    metrics?: Record<string, unknown>;
  };
}

export async function postPracticeSubmit(
  practiceId: string,
  answer: string,
): Promise<{
  ok: boolean;
  score: number | null;
  verdict: string;
  feedback: string;
}> {
  const res = await fetch(`${apiBase()}/api/practice/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practice_id: practiceId, answer }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`提交失败：${t}`);
  }
  return (await res.json()) as {
    ok: boolean;
    score: number | null;
    verdict: string;
    feedback: string;
  };
}
