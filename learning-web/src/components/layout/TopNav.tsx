"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartSpline, Home, Settings, SquareTerminal } from "lucide-react";

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--main-muted)] hover:bg-[var(--chip-bg)] hover:text-[var(--main-fg)]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function TopNav({
  title = "LearningWeb",
  rightSlot,
}: {
  title?: string;
  rightSlot?: React.ReactNode;
}) {
  const path = usePathname() || "";
  const is = (p: string) => path === p || path.startsWith(`${p}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"
            title="返回首页"
          >
            <span className="text-[14px] font-extrabold">L</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[var(--main-fg)]">
              {title}
            </p>
            <p className="truncate text-[11px] text-[var(--main-muted)]">
              AI 学习平台原型 · Final Phase
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="主导航">
          <NavItem
            href="/home"
            label="首页"
            active={is("/home")}
            icon={<Home className="h-4 w-4" />}
          />
          <NavItem
            href="/workspace"
            label="工作台"
            active={is("/workspace")}
            icon={<SquareTerminal className="h-4 w-4" />}
          />
          <NavItem
            href="/dashboard"
            label="数据看板"
            active={is("/dashboard")}
            icon={<ChartSpline className="h-4 w-4" />}
          />
          <NavItem
            href="/settings"
            label="设置"
            active={is("/settings")}
            icon={<Settings className="h-4 w-4" />}
          />
        </nav>

        <div className="flex items-center gap-2">
          {rightSlot}
          <Link
            href="/workspace"
            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            进入工作台
          </Link>
        </div>
      </div>
    </header>
  );
}
