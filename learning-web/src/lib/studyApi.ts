import { apiBase } from "./apiBase";

export type StudyEvent = {
  id: string;
  action: string;
  timestamp: string;
  item_id?: string;
  meta?: Record<string, unknown>;
};

export async function recordStudyEvent(opts: {
  action: string;
  itemId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(`${apiBase()}/api/study/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: opts.action,
      item_id: opts.itemId,
      meta: opts.meta,
    }),
  });
  if (!res.ok) throw new Error(`study event: HTTP ${res.status}`);
}

export async function getStudySummary(): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase()}/api/study/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error(`study summary: HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
