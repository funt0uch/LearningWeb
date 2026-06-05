"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartSpline,
  FileSearch,
  FolderOpen,
  Sparkles,
  Upload,
} from "lucide-react";
import { getDashboardOverview, getReviewRecommendations } from "@/lib/learningApi";

const ABILITIES = [
  {
    icon: Upload,
    title: "资料归档",
    desc: "按课程和主题管理本地资料，支持上传、搜索、筛选与 PDF 预览。",
  },
  {
    icon: Brain,
    title: "AI 整理",
    desc: "把 PDF 内容整理成错题报告和知识点总结，自动放回资料库。",
  },
  {
    icon: ChartSpline,
    title: "学习看板",
    desc: "汇总学习时长、错题沉淀、知识点分布和复习建议。",
  },
  {
    icon: FileSearch,
    title: "PDF 上下文问答",
    desc: "AI 助手可以结合当前 PDF 页面回答问题，减少重复描述。",
  },
  {
    icon: BookOpen,
    title: "复习闭环",
    desc: "从资料到错题，从知识点到再练习，让学习行为可追踪。",
  },
  {
    icon: Sparkles,
    title: "本地可运行",
    desc: "基于本地文件和 JSON 数据即可演示，适合继续扩展数据库和队列。",
  },
] as const;

export default function HomePage() {
  const [mins, setMins] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [rec, setRec] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const overview = await getDashboardOverview();
        setMins(overview.weekly_study_minutes);
        setWrong(overview.cumulative_wrong_total);
        const recommendations = await getReviewRecommendations(5);
        setRec(recommendations.today ?? []);
      } catch {
        setMins(null);
        setWrong(null);
      }
    })();
  }, []);

  const recommendationText = useMemo(
    () => (rec.length ? rec.join(" · ") : "整理错题后会自动生成今日复习建议"),
    [rec],
  );

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <TopNav title="项目首页" />

      <main>
        <section className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--main-bg)_88%,transparent)]">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="lw-reveal">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-[12px] font-bold text-[var(--accent)] shadow-[var(--shadow-sm)]">
                <Sparkles className="h-3.5 w-3.5" />
                AI 学习闭环原型
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-tight text-[var(--main-fg)] sm:text-5xl">
                LearningWeb
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-8 text-[var(--main-muted)]">
                面向大学生的智慧学习工作台。资料上传、PDF 阅读、AI 错题整理、
                知识点总结、复习推荐和数据看板都围绕本地文件运行，便于演示，也便于继续工程化扩展。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/workspace"
                  className="lw-scan inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-[15px] font-bold text-white shadow-[0_18px_32px_-18px_var(--accent-glow)] transition hover:-translate-y-px hover:opacity-95"
                >
                  进入工作台
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-6 py-3 text-[15px] font-bold text-[var(--main-fg)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
                >
                  查看数据看板
                  <ChartSpline className="h-4 w-4 text-[var(--accent)]" />
                </Link>
              </div>
            </div>

            <div className="lw-active-frame lw-panel rounded-lg p-6">
              <Image
                src="/learningweb-logo-full.png"
                alt="LearningWeb"
                width={828}
                height={594}
                className="mx-auto h-auto w-full max-w-[470px] object-contain"
                priority
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric title="本周学习" value={mins == null ? "--" : `${mins} 分钟`} />
                <Metric title="累计错题" value={wrong == null ? "--" : `${wrong}`} />
                <Metric title="复习建议" value={rec.length ? `${rec.length} 项` : "待生成"} />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="lw-panel rounded-lg p-6">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                今日复习
              </p>
              <p className="mt-4 text-[15px] leading-7 text-[var(--main-muted)]">
                {recommendationText}
              </p>
            </div>
            <div className="lw-panel rounded-lg p-6">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                学习流程
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-6">
                {["上传", "预览", "整理", "诊断", "再练", "看板"].map((step, index) => (
                  <div
                    key={step}
                    className="rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-3 py-4 text-center shadow-[var(--shadow-sm)]"
                  >
                    <span className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)]">
                      {index + 1}
                    </span>
                    <p className="mt-2 text-sm font-black">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--main-bg)_88%,transparent)] py-12">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                  Capabilities
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">核心能力</h2>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)] hover:underline"
              >
                配置模型与偏好
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ABILITIES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-lg border border-[var(--border)] bg-[var(--main-surface)] p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/20 hover:shadow-[var(--shadow-card)]"
                >
                  <Icon className="h-8 w-8 text-[var(--accent)]" strokeWidth={1.8} />
                  <h3 className="mt-4 text-[15px] font-black">{title}</h3>
                  <p className="mt-2 text-[13px] leading-7 text-[var(--main-muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--main-surface)] py-8 text-center text-[12px] text-[var(--main-muted)]">
        <FolderOpen className="mx-auto mb-2 h-4 w-4 text-[var(--accent)]" />
        E:\LearningWeb · 本地数据 · FastAPI + Next.js
      </footer>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--main-bg)] p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[12px] font-semibold text-[var(--main-muted)]">{title}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[var(--main-fg)]">{value}</p>
    </div>
  );
}
