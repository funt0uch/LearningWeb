import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学习资料库",
  description: "类 Notion 学习资料管理 · MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="h-full min-h-0 font-sans">{children}</body>
    </html>
  );
}
