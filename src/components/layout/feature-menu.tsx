import Link from "next/link";
import { uiConfig, type PageId } from "@/config/ui";

export function FeatureMenu({ pages }: { pages: readonly PageId[] }) {
  return (
    <div className="page-grid double feature-menu">
      {pages.map((id) => {
        const page = uiConfig.pages[id];
        return (
          <Link className="page-panel feature-link" key={id} href={page.href}>
            <strong>{page.label}</strong>
            <span>{page.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
