import Link from "next/link";
import type { ReactNode } from "react";
import { uiConfig, type PageId } from "@/config/ui";

export function PageLayout({
  page,
  children,
}: {
  page: PageId;
  children: ReactNode;
}) {
  const { label, title } = uiConfig.pages[page];
  const back = uiConfig.pages[page].href.startsWith("/admin/")
    ? uiConfig.pages.admin
    : uiConfig.pages.dashboard;
  return (
    <main className="page-shell" id="main-content" tabIndex={-1}>
      <header className="page-topbar">
        <div>
          <p className="eyebrow">{label}</p>
          <h1>{title}</h1>
        </div>
        {page !== "dashboard" && (
          <Link href={back.href} className="ghost-button">
            {back.label}へ戻る
          </Link>
        )}
      </header>
      {children}
    </main>
  );
}
