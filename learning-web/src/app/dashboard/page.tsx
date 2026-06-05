"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboardOverview,
  getReviewRecommendations,
  getWeeklyReport,
  type DashboardOverview,
} from "@/lib/learningApi";
import { Activity, Brain, CalendarDays, FileText, RefreshCw, Target } from "lucide-react";

const PIE_COLORS = ["#0f8f99", "#1a7ad1", "#16a34a", "#f59e0b", "#ef4444", "#64748b"];

function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="lw-panel rounded-lg p-5 transition hover:-translate-y-px hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-black uppercase tracking-wide text-[var(--main-muted)]">
            {title}
          </p>
          <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-[var(--main-fg)]">
            {value}
          </p>
          {sub ? <p className="mt-1 text-[12px] text-[var(--main-muted)]">{sub}</p> : null}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const overview = await getDashboardOverview();
        setData(overview);
        const review = await getReviewRecommendations(6);
        setRecommendations(review.today ?? []);
        setErr(null);
      } catch (error) {
        setErr(error instanceof Error ? error.message : "数据加载失败");
      }
    })();
  }, []);

  async function loadReport() {
    setReportBusy(true);
    setReport(null);
    try {
      const result = await getWeeklyReport();
      setReport(result.report);
    } catch (error) {
      setReport(error instanceof Error ? error.message : "周报生成失败");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <TopNav title="学习数据看板" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section className="lw-active-frame lw-panel rounded-lg px-6 py-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">学习数据一览</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-7 text-[var(--main-muted)]">
                汇总学习时长、错题数量、知识点分布和复习建议，让下一次复习更有方向。
              </p>
            </div>
            <button
              type="button"
              onClick={loadReport}
              disabled={reportBusy}
              className="lw-scan inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_32px_-18px_var(--accent-glow)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${reportBusy ? "animate-spin" : ""}`} />
              {reportBusy ? "生成中..." : "生成学习周报"}
            </button>
          </div>
        </section>

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 shadow-[var(--shadow-sm)]">
            {err}
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="本周学习时长"
                value={`${data.weekly_study_minutes} 分钟`}
                sub="近 7 日学习记录汇总"
                icon={<CalendarDays className="h-5 w-5" />}
              />
              <StatCard
                title="累计错题"
                value={`${data.cumulative_wrong_total}`}
                sub="来自错题整理结果"
                icon={<FileText className="h-5 w-5" />}
              />
              <StatCard
                title="复习参与度"
                value={`${data.review_engagement_percent}%`}
                sub="结合浏览、对话与推荐"
                icon={<Activity className="h-5 w-5" />}
              />
              <StatCard
                title="练习平均得分"
                value={
                  data.practice_accuracy_percent == null
                    ? "--"
                    : `${data.practice_accuracy_percent}%`
                }
                sub={data.practice_samples > 0 ? `${data.practice_samples} 次练习样本` : "暂无再练习数据"}
                icon={<Target className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="近 7 日学习时长">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily_study_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="#0f8f99"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="知识点错题分布">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.knowledge_bar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" interval={0} angle={-22} textAnchor="end" height={76} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0f8f99" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <ChartCard title="知识点占比">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.knowledge_pie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={98}
                      label={({ name, percent }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {data.knowledge_pie.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="lw-panel rounded-lg p-6">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[var(--accent)]" />
                  <h2 className="text-[15px] font-black">今日复习建议</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {(recommendations.length
                    ? recommendations
                    : ["先整理一份 PDF 错题，系统会自动生成薄弱知识点建议。"]
                  ).map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3 text-sm leading-6 text-[var(--main-fg)]"
                    >
                      <span className="mr-2 font-black text-[var(--accent)]">{index + 1}.</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {report ? (
              <section className="lw-panel rounded-lg p-6">
                <h2 className="text-[15px] font-black">AI 学习周报</h2>
                <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-950 p-5 text-[13px] leading-7 text-slate-50">
                  {report}
                </pre>
              </section>
            ) : null}
          </>
        ) : !err ? (
          <div className="lw-panel rounded-lg p-8 text-sm text-[var(--main-muted)]">
            正在加载学习数据...
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lw-panel rounded-lg p-6">
      <h2 className="text-[15px] font-black tracking-tight">{title}</h2>
      <div className="mt-4 h-[290px]">{children}</div>
    </div>
  );
}
