"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChartSpline, Home, LogOut, Settings, SquareTerminal } from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "首页", icon: Home },
  { href: "/workspace", label: "工作台", icon: SquareTerminal },
  { href: "/dashboard", label: "数据看板", icon: ChartSpline },
  { href: "/settings", label: "设置", icon: Settings },
] as const;

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
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-sm)]"
          : "text-[var(--main-muted)] hover:-translate-y-px hover:bg-[var(--chip-bg)] hover:text-[var(--main-fg)]"
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
  const router = useRouter();
  const is = (p: string) => path === p || path.startsWith(`${p}/`);

  function signOut() {
    window.localStorage.removeItem("learningweb.session");
    router.push("/login");
  }

  return (
    <header className="lw-hairline-top sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--main-bg)_88%,transparent)] shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[64px] max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/home"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:shadow-[var(--shadow-card)]"
            title="返回首页"
          >
            <Image
              src="/learningweb-mark.png"
              alt="LearningWeb"
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
              priority
            />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black tracking-tight text-[var(--main-fg)]">
              {title}
            </p>
            <p className="truncate text-[11px] text-[var(--main-muted)]">
              资料管理 · PDF 阅读 · AI 整理 · 复习闭环
            </p>
          </div>
        </div>

        <nav
          className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible"
          aria-label="主导航"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              active={is(href)}
              icon={<Icon className="h-4 w-4" />}
            />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {rightSlot}
          <Link
            href="/workspace"
            className="lw-scan rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white shadow-[0_10px_22px_-10px_var(--accent-glow)] transition hover:-translate-y-px hover:opacity-95 active:translate-y-0"
          >
            开始整理
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--main-muted)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)] hover:text-[var(--main-fg)]"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
