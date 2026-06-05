"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  ChartSpline,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { ParticleCanvas } from "@/components/login/ParticleCanvas";

const FEATURES = [
  { icon: BookOpenCheck, title: "资料归档", desc: "PDF、笔记、试卷和错题集中管理" },
  { icon: Brain, title: "AI 错题整理", desc: "自动提取题干、解析和知识点" },
  { icon: ChartSpline, title: "复习看板", desc: "学习时长、薄弱点和周报可视化" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("learningweb");
  const [password, setPassword] = useState("demo2026");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      "learningweb.session",
      JSON.stringify({
        account: account.trim() || "learningweb",
        name: "LearningWeb 学习者",
        remember,
        signedAt: new Date().toISOString(),
      }),
    );
    router.push("/home");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7fbff] text-slate-950">
      <ParticleCanvas />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/80 to-transparent" />

      <section className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            LearningWeb AI 智慧学习闭环平台
          </div>

          <div className="mt-8 max-w-xl">
            <Image
              src="/learningweb-logo-full.png"
              alt="LearningWeb"
              width={828}
              height={594}
              priority
              className="h-auto w-[330px] object-contain drop-shadow-[0_22px_50px_rgba(20,92,145,0.16)]"
            />
            <h1 className="mt-8 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              把资料、错题和复习反馈连成一条清晰路径
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              进入你的 AI 学习工作台，集中管理课程资料，预览 PDF，整理错题，
              追踪薄弱知识点，并生成可用于复盘的学习数据看板。
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/80 bg-white/68 p-4 shadow-[0_16px_48px_rgba(37,99,135,0.10)] backdrop-blur-xl"
              >
                <Icon className="h-5 w-5 text-sky-600" />
                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[440px]">
          <form
            onSubmit={handleSubmit}
            className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-[0_30px_90px_rgba(15,75,130,0.20)] backdrop-blur-2xl sm:p-8"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-700">欢迎回来</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  登录学习空间
                </h2>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <LockKeyhole className="h-5 w-5" />
              </span>
            </div>

            <label className="mt-8 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Account
              </span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white/86 px-4 text-sm font-medium text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                placeholder="请输入账号"
                autoComplete="username"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Password
              </span>
              <span className="mt-2 flex h-12 items-center rounded-2xl border border-slate-200 bg-white/86 shadow-inner shadow-slate-100 transition focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="min-w-0 flex-1 bg-transparent px-4 text-sm font-medium text-slate-900 outline-none"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="mr-2 grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600"
                />
                记住本地登录状态
              </label>
              <button type="button" className="font-semibold text-sky-700 hover:text-sky-900">
                演示账号
              </button>
            </div>

            <button
              type="submit"
              className="mt-8 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white shadow-[0_18px_42px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:bg-slate-900 active:translate-y-0"
            >
              进入 LearningWeb
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              当前为本地原型登录，用于页面演示和学习流程串联。
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
