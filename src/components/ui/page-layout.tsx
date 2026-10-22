import type { ReactNode } from "react";
import { uiConfig, type PageId } from "@/config/ui";
import { MaterialLinkButton } from "@/components/ui/material-link-button";

export function PageLayout({
  page,
  children,
  headerContent,
  headerMark,
  eyebrow,
}: {
  page: PageId;
  children: ReactNode;
  headerContent?: ReactNode;
  headerMark?: ReactNode;
  eyebrow?: string;
}) {
  const { label } = uiConfig.pages[page];
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
            (headerMark || eyebrow ? (
              <div className="page-heading-cluster">
                {headerMark && <span className="page-heading-mark">{headerMark}</span>}
                <div>
                  {eyebrow && <span className="page-heading-eyebrow">{eyebrow}</span>}
                  <h1>{label}</h1>
                </div>
              </div>
            ) : (
              <h1>{label}</h1>
            ))}
        </div>
        {page !== "dashboard" && page !== "storeSales" && (
          <MaterialLinkButton href={back.href}>{back.label}へ戻る</MaterialLinkButton>
        )}
      </header>
      {children}
    </main>
  );
}
