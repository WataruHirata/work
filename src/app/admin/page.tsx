import Link from "next/link";
import { PageLayout } from "@/components/ui/page-layout";
import { uiConfig } from "@/config/ui";
import { adminMenuFeatures, canUseAdminFeature } from "@/domain/access-policy";
import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function AdminPage() {
  const session = await requireAdminFeature();

  return (
    <PageLayout page="admin">
      <section className="admin-menu-panel page-panel" aria-labelledby="admin-menu-heading">
        <h2 id="admin-menu-heading">{uiConfig.pages.admin.label}</h2>
        <p className="muted">利用する業務を選んでください。</p>
        <nav className="admin-menu-grid" aria-label="管理機能">
          {adminMenuFeatures.map((feature) => {
            const page = uiConfig.pages[feature];
            const available =
              session.status === "unconfigured" || canUseAdminFeature(session.roles, feature);
            if (!available)
              return (
                <div key={feature} className="admin-menu-card is-disabled" aria-disabled="true">
                  <span className="admin-menu-text">
                    <strong>{page.label}</strong>
                    <span>{page.title}</span>
                  </span>
                  <span className="admin-menu-unavailable">権限なし</span>
                </div>
              );
            return (
              <Link key={feature} className="admin-menu-card" href={page.href}>
                <span className="admin-menu-text">
                  <strong>{page.label}</strong>
                  <span>{page.title}</span>
                </span>
                <span className="admin-menu-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
    </PageLayout>
  );
}
