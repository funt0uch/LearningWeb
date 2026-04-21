import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3 px-6 py-16">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--main-muted)]">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">页面不存在</h1>
        <p className="text-[13px] leading-relaxed text-[var(--main-muted)]">
          你访问的地址可能已变更。建议从首页或工作台入口重新进入。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/home"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            返回首页
          </Link>
          <Link
            href="/workspace"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-medium shadow-sm transition hover:bg-[var(--chip-bg)]"
          >
            进入工作台
          </Link>
        </div>
      </div>
    </div>
  );
}

