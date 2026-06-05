"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { setLearningWebTheme } from "@/components/theme/ThemeBootstrap";
import { getApiHealth, getSettings, putSettings } from "@/lib/learningApi";
import type { ApiHealth, AppSettings } from "@/lib/learningApi";

type Patch = Parameters<typeof putSettings>[0];

const MODEL_OPTIONS = [
  { id: "doubao", label: "豆包", vendor: "火山方舟", status: "已接入" },
  { id: "deepseek", label: "DeepSeek", vendor: "占位", status: "待接入" },
  { id: "qwen", label: "通义千问", vendor: "占位", status: "待接入" },
  { id: "openai", label: "OpenAI", vendor: "占位", status: "待接入" },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState("doubao");

  useEffect(() => {
    try {
      setSelectedModel(localStorage.getItem("learningweb.model") || "doubao");
    } catch {
      setSelectedModel("doubao");
    }
    void reload();
  }, []);

  async function reload() {
    setError(null);
    try {
      const [settingsResult, healthResult] = await Promise.all([getSettings(), getApiHealth()]);
      setSettings(settingsResult.settings);
      setHealth(healthResult);
      setLearningWebTheme(settingsResult.settings.theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置加载失败");
    }
  }

  async function savePatch(patch: Patch, fallback = "设置保存失败") {
    setBusy(true);
    setError(null);
    try {
      const result = await putSettings(patch);
      setSettings(result.settings);
      if (typeof patch.theme === "string") setLearningWebTheme(patch.theme);
      setHealth(await getApiHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function chooseModel(model: string) {
    setSelectedModel(model);
    try {
      localStorage.setItem("learningweb.model", model);
    } catch {
      // Local preference only.
    }
  }

  const runtime = settings?.runtime;
  const dailyGoal = settings?.learning_prefs?.daily_goal_minutes ?? 30;
  const reviewReminder = Boolean(settings?.learning_prefs?.review_reminder);
  const showGraph = settings?.ui?.show_knowledge_graph !== false;
  const weakTopN = settings?.ui?.weak_top_n ?? 5;

  return (
    <div className="min-h-screen bg-[var(--shell-bg)] text-[var(--main-fg)]">
      <TopNav title="设置中心" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="lw-active-frame lw-panel mb-7 rounded-lg p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                Runtime & Preferences
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--main-fg)]">
                运行状态和学习偏好
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[var(--main-muted)]">
                这里集中管理模型、主题、学习目标和本地服务状态。当前项目以豆包为默认模型，
                其他模型先做占位，后续只需要补 provider 即可接入。
              </p>
            </div>
            <div className="grid min-w-[250px] gap-2 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] p-4 text-[13px] text-[var(--main-muted)] shadow-inner">
              <StatusLine active={Boolean(health?.ok)} label="后端服务" />
              <StatusLine
                active={Boolean(health?.api_key_configured ?? runtime?.api_key_configured)}
                label="AI Key"
              />
              <StatusLine active={Boolean(runtime?.ocr_runtime_enabled)} label="OCR 运行时" />
            </div>
          </div>
        </section>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 shadow-[var(--shadow-sm)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        ) : null}

        {!settings ? (
          <div className="lw-panel rounded-lg p-8 text-[14px] text-[var(--main-muted)]">
            正在加载设置...
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <SettingCard
              icon={<KeyRound className="h-5 w-5" />}
              title="模型选择"
              desc="当前实际接入的是豆包。其他模型按钮用于展示扩展位，不会立即改变后端 provider。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {MODEL_OPTIONS.map((model) => {
                  const active = selectedModel === model.id;
                  const enabled = model.id === "doubao";
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => chooseModel(model.id)}
                      className={`rounded-lg border px-4 py-4 text-left transition hover:-translate-y-px ${
                        active
                          ? "lw-active-frame border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-[var(--main-surface)] hover:bg-[var(--chip-bg)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[15px] font-black text-[var(--main-fg)]">
                          {model.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {model.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-[var(--main-muted)]">{model.vendor}</p>
                    </button>
                  );
                })}
              </div>
            </SettingCard>

            <SettingCard
              icon={<Cloud className="h-5 w-5" />}
              title="运行健康"
              desc="确认本地 FastAPI、模型 Key、OCR 和上传限制是否处于可用状态。"
            >
              <div className="space-y-3">
                <InfoRow label="服务名称" value={health?.service ?? "未连接"} active={Boolean(health?.ok)} />
                <InfoRow
                  label="大模型 API Key"
                  value={health?.api_key_configured ? "已配置" : "未检测到环境变量"}
                  active={Boolean(health?.api_key_configured)}
                />
                <InfoRow
                  label="OCR 运行时"
                  value={runtime?.ocr_runtime_enabled ? "可用" : "未启用"}
                  active={Boolean(runtime?.ocr_runtime_enabled)}
                />
                <InfoRow label="单文件上传上限" value={`${health?.max_upload_mb ?? 80} MB`} active />
              </div>
            </SettingCard>

            <SettingCard
              icon={<Database className="h-5 w-5" />}
              title="本地数据"
              desc="当前使用本地文件和 JSON 存储，便于迁移、调试和演示。"
            >
              <div className="space-y-3">
                <InfoRow label="资料索引数量" value={`${health?.files_count ?? 0} 个文件`} active />
                <div className="rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3">
                  <p className="text-[12px] font-bold text-[var(--main-fg)]">数据目录</p>
                  <p className="mt-1 break-all text-[12px] leading-5 text-[var(--main-muted)]">
                    {health?.data_root ?? "等待后端返回"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reload()}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-[12px] font-bold text-[var(--main-fg)] shadow-sm transition hover:-translate-y-px hover:bg-[var(--chip-bg)]"
                >
                  刷新状态
                </button>
              </div>
            </SettingCard>

            <SettingCard
              icon={<Palette className="h-5 w-5" />}
              title="界面外观"
              desc="主题偏好会保存到后端配置，并即时应用到当前浏览器。"
            >
              <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--chip-bg)] p-1">
                {(["light", "dark"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    disabled={busy}
                    className={`rounded-lg px-5 py-2 text-[13px] font-bold transition ${
                      settings.theme === theme
                        ? "bg-[var(--card-bg)] text-[var(--accent)] shadow-[var(--shadow-sm)]"
                        : "text-[var(--main-muted)] hover:text-[var(--main-fg)]"
                    }`}
                    onClick={() => void savePatch({ theme })}
                  >
                    {theme === "light" ? "清亮模式" : "深色偏好"}
                  </button>
                ))}
              </div>
            </SettingCard>

            <SettingCard
              icon={<Sparkles className="h-5 w-5" />}
              title="学习偏好"
              desc="调整每日目标和复习提醒，让学习闭环保留稳定节奏。"
            >
              <ToggleRow
                checked={Boolean(settings.ocr_preference)}
                disabled={busy}
                label="上传资料后优先尝试 OCR"
                onChange={(checked) => void savePatch({ ocr_preference: checked })}
              />
              <RangeRow
                label="每日学习目标"
                suffix="分钟"
                min={10}
                max={120}
                step={5}
                value={dailyGoal}
                disabled={busy}
                onChange={(value) =>
                  void savePatch({
                    learning_prefs: { ...settings.learning_prefs, daily_goal_minutes: value },
                  })
                }
              />
              <ToggleRow
                checked={reviewReminder}
                disabled={busy}
                label="开启复习提醒偏好"
                onChange={(checked) =>
                  void savePatch({
                    learning_prefs: { ...settings.learning_prefs, review_reminder: checked },
                  })
                }
              />
            </SettingCard>

            <SettingCard
              icon={<SlidersHorizontal className="h-5 w-5" />}
              title="看板展示"
              desc="控制知识关系图和薄弱知识点数量，让看板更聚焦。"
            >
              <ToggleRow
                checked={showGraph}
                disabled={busy}
                label="显示知识点关系图"
                onChange={(checked) =>
                  void savePatch({ ui: { ...settings.ui, show_knowledge_graph: checked } })
                }
              />
              <RangeRow
                label="薄弱知识点数量"
                suffix="项"
                min={3}
                max={10}
                step={1}
                value={weakTopN}
                disabled={busy}
                onChange={(value) => void savePatch({ ui: { ...settings.ui, weak_top_n: value } })}
              />
            </SettingCard>
          </div>
        )}
      </main>
    </div>
  );
}

function SettingCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="lw-panel rounded-lg p-6 transition hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        <div>
          <h2 className="text-[16px] font-black tracking-tight text-[var(--main-fg)]">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-[var(--main-muted)]">{desc}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function StatusLine({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-bold ${active ? "text-emerald-600" : "text-amber-600"}`}>
        <CheckCircle2 className="h-4 w-4" />
        {active ? "已就绪" : "待配置"}
      </span>
    </div>
  );
}

function InfoRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3 text-[13px]">
      <span className="text-[var(--main-muted)]">{label}</span>
      <span className={active ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
        {value}
      </span>
    </div>
  );
}

function ToggleRow({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3 text-[13px] text-[var(--main-muted)]">
      <span>{label}</span>
      <input
        className="h-4 w-4 accent-[var(--accent)]"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function RangeRow({
  label,
  suffix,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-[var(--border)] bg-[var(--main-surface)] px-4 py-3 text-[13px] text-[var(--main-muted)]">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-bold text-[var(--main-fg)]">
          {value} {suffix}
        </span>
      </span>
      <input
        className="mt-3 w-full accent-[var(--accent)]"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
