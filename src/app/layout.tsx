import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "みのり屋 | 販売管理",
  description: "売上、店舗、商品、運用状況を確認する販売管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
