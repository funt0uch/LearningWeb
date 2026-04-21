"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  BookOpen,
  Brain,
  ChartSpline,
  FolderOpen,
  Sparkles,
  Upload,
} from "lucide-react";
import { getDashboardOverview, getReviewRecommendations } from "@/lib/learningApi";

export default function LandingPage() {
  const [mins, setMins] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [rec, setRec] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const d = await getDashboardOverview();
        setMins(d.weekly_study_minutes);
        setWrong(d.cumulative_wrong_total);
        const rv = await getReviewRecommendations(5);
        setRec(rv.today ?? []);
      } catch {
        setMins(null);
        setWrong(null);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <TopNav title="项目首页" />
      <header className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-br from-[#fbfbfa] via-white to-[#eef4fc]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--accent-soft)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[#e8f4ff] blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-[12px] font-medium text-[var(--main-muted)] shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Phase 4 · AI 学习平台原型
          </div>
          <h1 className="bg-gradient-to-r from-[#1a1f2e] to-[#2383e2] bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            LearningWeb
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--main-muted)]">
            本地资料管理 · PDF 与 OCR · 错题整理与再练 · 知识点图谱与学习看板。
            从「资料网站」进化为可答辩、可演示的
            <span className="font-semibold text-[var(--main-fg)]"> AI 学习工作台</span>。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(35,131,226,0.35)] transition hover:translate-y-[-1px] hover:opacity-95"
            >
              <FolderOpen className="h-5 w-5" />
              进入工作台
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-6 py-3 text-[15px] font-semibold text-[var(--main-fg)] shadow-[var(--shadow-card)] transition hover:bg-[var(--chip-bg)]"
            >
              <ChartSpline className="h-5 w-5 text-[var(--accent)]" />
              学习数据看板
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-lg font-semibold text-[var(--main-fg)]">
          实时概览
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]">
            <p className="text-[12px] font-medium text-[var(--main-muted)]">本周学习时长</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--accent)]">
              {mins != null ? `${mins}` : "—"}
              <span className="ml-1 text-lg font-normal text-[var(--main-muted)]">分</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]">
            <p className="text-[12px] font-medium text-[var(--main-muted)]">累计错题条目</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--main-fg)]">
              {wrong != null ? wrong : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]">
            <p className="text-[12px] font-medium text-[var(--main-muted)]">推荐复习</p>
            <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-[var(--main-muted)]">
              {rec.length ? rec.join(" · ") : "整理错题后将显示推荐知识点"}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-white/70 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-lg font-semibold">核心能力</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Upload,
                title: "本地与解析",
                desc: "文件夹树、上传与 PDF 预览；扫描件自动 OCR，弱依赖不崩溃。",
              },
              {
                icon: Brain,
                title: "AI 错题链路",
                desc: "整理、去重、详情页、同类再练与判分，形成完整学习闭环。",
              },
              {
                icon: ChartSpline,
                title: "数据与推荐",
                desc: "知识点统计、复习推荐、学习埋点与仪表盘图表，可演进画像与遗忘曲线。",
              },
              {
                icon: BookOpen,
                title: "学习助手",
                desc: "右侧真对话：讲题、总结、相似题，服务层统一接入 LLM。",
              },
              {
                icon: Sparkles,
                title: "答辩展示",
                desc: "知识图谱树、周报生成、看板与落地页，直接用于大创与毕设演示。",
              },
              {
                icon: FolderOpen,
                title: "配置与扩展",
                desc: "settings.json、环境可调 OCR/模型，便于部署与二次开发。",
              },
            ].map((x) => (
              <div
                key={x.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--main-surface)] p-5 shadow-sm transition duration-300 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card)]"
              >
                <x.icon className="h-8 w-8 text-[var(--accent)]" strokeWidth={1.75} />
                <h3 className="mt-3 text-[15px] font-semibold">{x.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--main-muted)]">
                  {x.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--main-surface)] py-8 text-center text-[12px] text-[var(--main-muted)]">
        <Link href="/settings" className="text-[var(--accent)] hover:underline">
          学习设置
        </Link>
        <span className="mx-2">·</span>
        <span>E:\LearningWeb · 本地数据 · FastAPI + Next.js</span>
      </footer>
    </div>
  );
}
