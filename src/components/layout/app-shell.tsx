"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  LogIn,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBasket,
  TrendingUp,
  Bell,
  RefreshCw,
} from "lucide-react";
import { uiConfig } from "@/config/ui";
import { isAdminPath } from "@/domain/access-policy";
import { disconnectStation } from "@/server/actions/station";
import { logout } from "@/server/actions/auth";
import { resolveSwipeAction } from "@/components/layout/swipe-gesture";

const icons = {
  storeSales: TrendingUp,
  storeOrders: ShoppingBasket,
  storeOperations: ClipboardCheck,
  storeCampaigns: Package,
  storeNotices: Bell,
};

export function AppShell({
  children,
  stationConnected,
}: {
  children: ReactNode;
  stationConnected: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshFeedback, setRefreshFeedback] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const mainRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{
    startX: number;
    startY: number;
    startedInDrawer: boolean;
  } | null>(null);
  const admin = isAdminPath(pathname);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const closeDrawerOnMobile = () => {
      if (media.matches) setSidebarOpen(false);
    };
    closeDrawerOnMobile();
    media.addEventListener("change", closeDrawerOnMobile);
    return () => media.removeEventListener("change", closeDrawerOnMobile);
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let startY: number | null = null;
    let feedbackTimeout: number | undefined;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        startY = null;
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        target.closest(
          'a,button,input,textarea,select,[contenteditable="true"],.table-scroll,[data-no-pull-refresh]',
        ) ||
        window.scrollY > 0 ||
        document.documentElement.scrollTop > 0
      ) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (startY === null || event.touches.length !== 1) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      if (delta > 8) event.preventDefault();
      setPullDistance(Math.min(72, delta));
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (startY === null) return;
      const delta = event.changedTouches[0]?.clientY - startY;
      startY = null;
      if (delta >= 68) {
        setRefreshFeedback(true);
        startRefresh(() => router.refresh());
        feedbackTimeout = window.setTimeout(() => setRefreshFeedback(false), 450);
      }
      setPullDistance(0);
    };
    const onTouchCancel = () => {
      startY = null;
      setPullDistance(0);
    };
    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: false });
    main.addEventListener("touchend", onTouchEnd, { passive: true });
    main.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
      main.removeEventListener("touchcancel", onTouchCancel);
      window.clearTimeout(feedbackTimeout);
    };
  }, [router]);

  const onShellTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      swipeStart.current = null;
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const startedInDrawer = Boolean(target?.closest(".global-sidebar"));
    if (
      !startedInDrawer &&
      target?.closest("a,button,input,textarea,select,[contenteditable='true']")
    ) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = {
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
      startedInDrawer,
    };
  };
  const onShellTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const action = resolveSwipeAction({
      ...start,
      endX: touch.clientX,
      endY: touch.clientY,
      viewportWidth: window.innerWidth,
      drawerOpen: sidebarOpen,
    });
    if (action === "open-menu") setSidebarOpen(true);
    if (action === "close-menu") setSidebarOpen(false);
  };
  return (
    <div
      className={`global-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}
      onTouchStart={onShellTouchStart}
      onTouchEnd={onShellTouchEnd}
    >
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
          <Link className="brand" href="/" aria-label="みのり屋">
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
          <Link className="support-card" href="/login?next=%2Fadmin">
            <span className="support-icon">
              <LogIn size={18} />
            </span>
            <span>
              <strong>権限機能にログイン</strong>
            </span>
            <ArrowRight className="support-arrow" size={15} />
          </Link>
          {admin && (
            <>
              <form action={logout}>
                <button type="submit" className="ghost-button station-sidebar-action">
                  権限機能からログアウト
                </button>
              </form>
            </>
          )}
          {stationConnected ? (
            <form action={disconnectStation}>
              <button type="submit" className="ghost-button station-sidebar-action">
                店舗端末の登録を解除
              </button>
            </form>
          ) : (
            <Link className="ghost-button station-sidebar-action" href="/station">
              店舗端末を登録
            </Link>
          )}
        </div>
      </aside>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="global-main" ref={mainRef}>
        <div
          className={`pull-refresh-indicator${pullDistance || refreshFeedback || isRefreshing ? " is-visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          <RefreshCw
            className={isRefreshing ? "pull-refresh-icon is-refreshing" : "pull-refresh-icon"}
            size={16}
            aria-hidden="true"
            style={{ transform: `rotate(${Math.round((pullDistance / 72) * 180)}deg)` }}
          />
          <span>{isRefreshing ? "更新中" : pullDistance >= 68 ? "離して更新" : "引いて更新"}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
