import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { uiConfig, themeStyle, responsiveStyles } from "@/config/ui";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AppProviders } from "./providers";
import "./globals.css";
import { stationCookie } from "@/server/auth/store-context";

export const metadata: Metadata = {
  title: uiConfig.brand.title,
  description: uiConfig.brand.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const stationConnected = (await cookies()).has(stationCookie);
  return (
    <html lang="ja" style={themeStyle}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <AppProviders>
            <AppShell stationConnected={stationConnected}>{children}</AppShell>
            <style>{responsiveStyles}</style>
          </AppProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
