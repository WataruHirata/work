import Link from "next/link";
import { uiConfig, type PageId } from "@/config/ui";

export function FeatureMenu({ pages, allowed }: { pages: readonly PageId[]; allowed?: readonly PageId[] }) {
  return <div className="page-grid double feature-menu">
    {pages.map((id) => {
      const page = uiConfig.pages[id];
      const enabled = !allowed || allowed.includes(id);
      return enabled
        ? <Link className="page-panel feature-link" key={id} href={page.href}><strong>{page.label}</strong><span>{page.title}</span></Link>
        : <div className="page-panel feature-link muted" key={id} aria-disabled="true"><strong>{page.label}</strong><span>利用権限がありません</span></div>;
    })}
  </div>;
}
