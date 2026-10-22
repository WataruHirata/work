"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  TrendingUp,
  Bell,
} from "lucide-react";
import { uiConfig } from "@/config/ui";
import { isAdminPath } from "@/domain/access-policy";
import { logout } from "@/server/actions/auth";

const icons = {
  storeSales: TrendingUp,
  storeOrders: ShoppingBasket,
  storeOperations: ClipboardCheck,
  storeCampaigns: Package,
  storeNotices: Bell,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const admin = isAdminPath(pathname);
  return (
    <div className={`global-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <aside className="global-sidebar" aria-label="メインメニュー">
        <div className="global-sidebar-header">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((current) => !current)}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <Link className="brand" href="/" aria-label="みのり屋 店舗ポータル">
            <span className="brand-mark">
              <ShoppingBasket size={21} />
            </span>
            <span className="brand-copy">
              <strong>{uiConfig.brand.name}</strong>
              <small>{uiConfig.brand.subtitle}</small>
            </span>
          </Link>
        </div>
        <div className="workspace-label">{admin ? "管理機能" : "店舗機能"}</div>
        <nav className="nav-list" aria-label="店舗機能">
          <Link
            className={`nav-item ${pathname === "/" ? "active" : ""}`}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <LayoutDashboard size={18} />
            <span>{uiConfig.pages.dashboard.label}</span>
          </Link>
          {uiConfig.navigation.map((id) => {
            const page = uiConfig.pages[id];
            const Icon = icons[id];
            const active = pathname === page.href;
            return (
              <Link
                key={id}
                href={page.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{page.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link className="support-card" href={admin ? "/admin" : "/login?next=%2Fadmin"}>
            <span className="support-icon">
              <LogIn size={18} />
            </span>
            <span>
              <strong>{admin ? uiConfig.pages.admin.label : uiConfig.pages.login.label}</strong>
              <small>本部・上位権限の機能</small>
            </span>
            <ArrowRight className="support-arrow" size={15} />
          </Link>
          <Link className="ghost-button" href="/station">
            店舗端末の接続
          </Link>
          <form action={logout}>
            <button type="submit" className="ghost-button">
              個人ログインを終了
            </button>
          </form>
          <p className="muted">通常の店舗メニューはログイン不要です</p>
        </div>
      </aside>
      <div className="global-main">{children}</div>
    </div>
  );
}
