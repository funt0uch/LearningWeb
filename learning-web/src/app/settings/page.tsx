"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { getSettings, putSettings } from "@/lib/learningApi";
import type { AppSettings } from "@/lib/learningApi";

export default function SettingsPage() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await getSettings();
        setS(r.settings);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, []);

  async function saveTheme(next: "light" | "dark") {
    setBusy(true);
    setErr(null);
    try {
      const r = await putSettings({ theme: next });
      setS(r.settings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOcrPref(v: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const r = await putSettings({ ocr_preference: v });
      setS(r.settings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const rt = s?.runtime;

  return (
    <div className="min-h-screen bg-[var(--main-bg)] text-[var(--main-fg)]">
      <TopNav title="学习设置" />
      <main className="mx-auto max-w-lg px-6 py-8">
        {err ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {err}
          </div>
        ) : null}
        {!s ? (
          <p className="text-[13px] text-[var(--main-muted)]">加载中…</p>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold">连接状态</h2>
              <ul className="mt-2 space-y-1 text-[13px] text-[var(--main-muted)]">
                <li>
                  LLM API Key：{" "}
                  <span className={rt?.api_key_configured ? "text-green-700" : "text-amber-700"}>
                    {rt?.api_key_configured ? "已配置（服务端）" : "未检测到环境变量"}
                  </span>
                </li>
                <li>
                  OCR 运行时：{" "}
                  {rt?.ocr_runtime_enabled ? (
                    <span className="text-[var(--main-fg)]">开启</span>
                  ) : (
                    <span className="text-amber-700">已关闭（OCR_ENABLED）</span>
                  )}
                </li>
              </ul>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold">外观</h2>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                    s.theme === "light" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"
                  }`}
                  onClick={() => void saveTheme("light")}
                >
                  浅色
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                    s.theme === "dark" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)]"
                  }`}
                  onClick={() => void saveTheme("dark")}
                >
                  深色（前端仅占位，尚未全局换肤）
                </button>
              </div>
            </section>
            <section className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-[13px] font-semibold">学习偏好</h2>
              <label className="mt-2 flex items-center gap-2 text-[13px] text-[var(--main-muted)]">
                <input
                  type="checkbox"
                  checked={Boolean(s.ocr_preference)}
                  disabled={busy}
                  onChange={(e) => void toggleOcrPref(e.target.checked)}
                />
                默认希望使用 OCR（与后端弱依赖并存，可在服务端关闭）
              </label>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
