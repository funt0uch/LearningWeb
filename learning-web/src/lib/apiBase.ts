export function apiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000").trim();
  return raw
    .replace(/\s+/g, "")
    .replace(/\/+$/, "")
    .replace("http://localhost:", "http://127.0.0.1:");
}
