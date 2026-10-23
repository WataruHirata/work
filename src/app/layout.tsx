import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { uiConfig, themeStyle, responsiveStyles } from "@/config/ui";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AppProviders } from "./providers";
import "./globals.css";
import { stationCookie } from "@/server/auth/store-context";
import { StoreAnnouncements } from "@/components/notifications/store-announcements";
import { backendConfigured, identity } from "@/server/container";
import { activeAdminRoleCookie } from "@/server/auth/admin-role";
import { hasAdminAccess, isAdminRole } from "@/domain/access-policy";

export const metadata: Metadata = {
  title: uiConfig.brand.title,
  description: uiConfig.brand.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const stationConnected = cookieStore.has(stationCookie);
  let adminEntryState: "anonymous" | "select-role" | "ready" = "anonymous";
  if (backendConfigured()) {
    try {
      const session = await identity().session();
      if (session?.active && !session.mustChangePassword) {
        const roles = session.roles.filter(isAdminRole);
        const selectedRole = cookieStore.get(activeAdminRoleCookie)?.value;
        adminEntryState =
          selectedRole &&
          roles.includes(selectedRole as (typeof roles)[number]) &&
          hasAdminAccess([selectedRole])
            ? "ready"
            : roles.length
              ? "select-role"
              : "anonymous";
      }
    } catch {
      adminEntryState = "anonymous";
    }
  }
  return (
    <html lang="ja" style={themeStyle}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <AppProviders>
            <AppShell
              stationConnected={stationConnected}
              adminEntryState={adminEntryState}
              storeNotifications={<StoreAnnouncements />}
            >
              {children}
            </AppShell>
            <style>{responsiveStyles}</style>
          </AppProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
