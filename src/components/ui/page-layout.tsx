import type { ReactNode } from "react";
import { uiConfig, type PageId } from "@/config/ui";
import { MaterialLinkButton } from "@/components/ui/material-link-button";

export function PageLayout({
  page,
  children,
  headerContent,
}: {
  page: PageId;
  children: ReactNode;
  headerContent?: ReactNode;
}) {
  const { label, title } = uiConfig.pages[page];
  const back = uiConfig.pages[page].href.startsWith("/admin/")
    ? uiConfig.pages.admin
    : uiConfig.pages.dashboard;
  return (
    <main
      className={`page-shell${headerContent ? " page-shell-custom-header" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <header className={`page-topbar${headerContent ? " page-topbar-custom" : ""}`}>
        <div className={headerContent ? "page-header-custom-content" : undefined}>
          {headerContent ?? (
            <>
              <p className="eyebrow">{label}</p>
              <h1>{title}</h1>
            </>
          )}
        </div>
        {page !== "dashboard" && page !== "storeSales" && (
          <MaterialLinkButton href={back.href}>{back.label}へ戻る</MaterialLinkButton>
        )}
      </header>
      {children}
    </main>
  );
}
