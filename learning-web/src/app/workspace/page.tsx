"use client";

import { TopNav } from "@/components/layout/TopNav";
import { AppShell } from "@/components/layout/AppShell";

export default function WorkspacePage() {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-[var(--shell-bg)]">
      <TopNav title="学习工作台" />
      <div className="min-h-0 flex-1">
        <AppShell />
      </div>
    </div>
  );
}
