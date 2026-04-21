"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">页面出了点问题</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--main-muted)]">
          这通常是后端未启动、API Key 未配置或网络请求失败导致的。你可以先重试，
          或回到首页重新进入。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            重试
          </button>
          <Link
            href="/home"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-medium shadow-sm transition hover:bg-[var(--chip-bg)]"
          >
            返回首页
          </Link>
          <Link
            href="/settings"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-medium shadow-sm transition hover:bg-[var(--chip-bg)]"
          >
            检查设置
          </Link>
        </div>
        <details className="mt-6 rounded-xl border border-[var(--border)] bg-white p-4">
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--main-fg)]">
            错误详情（调试）
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-[12px] text-[var(--main-muted)]">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}

