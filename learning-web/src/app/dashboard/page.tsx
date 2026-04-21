"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const PIE_COLORS = [
  "#2383e2",
  "#0d8f6e",
  "#c9781a",
  "#9b51e0",
  "#e05555",
  "#5c6578",
  "#2d6a4f",
  "#9d4edd",
];

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="group rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
      <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--main-muted)]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--main-fg)]">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-[12px] text-[var(--main-muted)]">{sub}</p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [rec, setRec] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const d = await getDashboardOverview();
        setData(d);
        const rv = await getReviewRecommendations(6);
        setRec(rv.today ?? []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加载失败");
      }
    })();
  }, []);

  async function loadReport() {
    setReportBusy(true);
    setReport(null);
    try {
      const r = await getWeeklyReport();
      setReport(r.report);
    } catch (e) {
      setReport(e instanceof Error ? e.message : "生成失败");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <TopNav title="学习数据看板" />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {err}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="本周学习时长"
                value={`${data.weekly_study_minutes} 分钟`}
                sub="按 session 上报汇总（近 7 日）"
              />
              <StatCard
                title="累计错题（条目）"
                value={`${data.cumulative_wrong_total}`}
                sub="来自错题整理 JSON 聚合"
              />
              <StatCard
                title="复习参与度"
                value={`${data.review_engagement_percent}%`}
                sub="结合浏览/对话与推荐维度的启发式指标"
              />
              <StatCard
                title="练习平均得分"
                value={
                  data.practice_accuracy_percent != null
                    ? `${data.practice_accuracy_percent}`
                    : "—"
                }
                sub={
                  data.practice_samples > 0
                    ? `基于 ${data.practice_samples} 次批改`
                    : "暂无再练批改数据"
                }
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-[15px] font-semibold">近 7 日学习时长（分钟）</h2>
                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.daily_study_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e4" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => (v as string).slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke="#2383e2"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-[15px] font-semibold">知识点错题分布（Top）</h2>
                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.knowledge_bar}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e4" />
                      <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2383e2" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-[15px] font-semibold">知识点占比（饼图）</h2>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.knowledge_pie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({
                          name,
                          percent,
                        }: {
                          name?: string;
                          percent?: number;
                        }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {data.knowledge_pie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-[15px] font-semibold">本周推荐复习（来自推荐引擎）</h2>
                <ul className="mt-4 space-y-2">
                  {rec.length ? (
                    rec.map((x) => (
                      <li
                        key={x}
                        className="rounded-xl border border-[var(--border)] bg-[var(--chip-bg)] px-3 py-2 text-[13px]"
                      >
                        {x}
                      </li>
                    ))
                  ) : (
                    <li className="text-[13px] text-[var(--main-muted)]">暂无推荐数据</li>
                  )}
                </ul>
                <p className="mt-3 text-[11px] text-[var(--main-muted)]">
                  活动：本周浏览 {data.week_activity?.views ?? 0} · 对话{" "}
                  {data.week_activity?.chats ?? 0}
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-white to-[var(--chip-bg)] p-6 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold">学习周报（LLM 自动生成）</h2>
                <button
                  type="button"
                  disabled={reportBusy}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
                  onClick={() => void loadReport()}
                >
                  {reportBusy ? "生成中…" : "生成本周周报"}
                </button>
              </div>
              {report ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-white/80 p-4 text-[13px] leading-relaxed text-[var(--main-fg)] shadow-inner">
                  {report}
                </pre>
              ) : (
                <p className="mt-3 text-[13px] text-[var(--main-muted)]">
                  点击按钮拉取周报（需后端 LLM；失败时使用模板文本）。
                </p>
              )}
            </section>
          </>
        ) : !err ? (
          <p className="text-[13px] text-[var(--main-muted)]">正在加载看板数据…</p>
        ) : null}
      </main>
    </div>
  );
}
