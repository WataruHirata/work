import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  LogIn,
  Package,
  ScrollText,
  Settings,
  ShoppingBasket,
  Store,
  Tag,
  TrendingUp,
  Users,
} from "@/components/ui/icons";
import { uiConfig, type PageId } from "@/config/ui";
import { MaterialLinkButton } from "@/components/ui/material-link-button";

const pageMarks = {
  dashboard: LayoutDashboard,
  stores: Store,
  sales: TrendingUp,
  orders: ShoppingBasket,
  approvals: ClipboardCheck,
  campaigns: Tag,
  notices: Bell,
  settings: Settings,
  products: Package,
  monthly: CalendarDays,
  imports: Database,
  users: Users,
  audit: ScrollText,
  login: LogIn,
} as const;

export function PageLayout({
  page,
  children,
  headerContent,
  headerMark,
  eyebrow,
  headerTitle,
  headerMeta,
}: {
  page: PageId;
  children: ReactNode;
  headerContent?: ReactNode;
  headerMark?: ReactNode;
  eyebrow?: string;
  headerTitle?: ReactNode;
  headerMeta?: ReactNode;
}) {
  const { label, icon, eyebrow: defaultEyebrow } = uiConfig.pages[page];
  const PageMark = pageMarks[icon as keyof typeof pageMarks] ?? Activity;
  const mark = headerMark ?? <PageMark size={20} aria-hidden="true" />;
  const back = uiConfig.pages[page].href.startsWith("/admin/")
    ? uiConfig.pages.admin
    : uiConfig.pages.dashboard;
  return (
    <main
      className={`page-shell motion-region${headerContent ? " page-shell-custom-header" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <header className={`page-topbar${headerContent ? " page-topbar-custom" : ""}`}>
        <div className={headerContent ? "page-header-custom-content" : undefined}>
          {headerContent ??
            (mark || eyebrow || defaultEyebrow ? (
              <div className="page-heading-cluster">
                <span className="page-heading-mark">{mark}</span>
                <div>
                  <span className="page-heading-eyebrow">{eyebrow ?? defaultEyebrow}</span>
                  <h1>{headerTitle ?? label}</h1>
                </div>
              </div>
            ) : (
              <h1>{headerTitle ?? label}</h1>
            ))}
        </div>
        {headerMeta && <div className="page-header-meta">{headerMeta}</div>}
        {page !== "dashboard" && page !== "storeSales" && (
          <MaterialLinkButton href={back.href}>{back.label}へ戻る</MaterialLinkButton>
        )}
      </header>
      {children}
    </main>
  );
}
