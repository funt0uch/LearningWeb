/** 与 filesApi 一致的后端基址，避免循环依赖 */
export function apiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
    "http://127.0.0.1:8000";
  return raw.replace("http://localhost:", "http://127.0.0.1:");
}
