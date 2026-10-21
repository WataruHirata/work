import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { uiConfig, themeStyle, responsiveStyles } from "@/config/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: uiConfig.brand.title,
  description: uiConfig.brand.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja" style={themeStyle}>
      <body>
        <AppShell>{children}</AppShell>
      <style>{responsiveStyles}</style>
      </body>
    </html>
  );
}
