import type { Metadata } from "next";
import { ThemeBootstrap } from "@/components/theme/ThemeBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "LearningWeb AI 智慧学习闭环平台",
  description: "资料管理、AI 错题整理、学习看板与复习闭环原型",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full min-h-0 font-sans">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
