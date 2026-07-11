// app/layout.tsx
// 根布局：引入 globals.css，设置中文字体（系统字体栈，避免网络字体依赖）。
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POMOS · 物理竞赛导师",
  description: "面向中国高中物理竞赛（CPhO / IPhO）的 AI-Native 导师系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
