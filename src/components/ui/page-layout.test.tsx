import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { uiConfig } from "@/config/ui";
import { PageLayout } from "@/components/ui/page-layout";

describe("PageLayout shared headers", () => {
  it("renders a mark and English eyebrow for every configured page", () => {
    for (const page of Object.keys(uiConfig.pages) as (keyof typeof uiConfig.pages)[]) {
      const html = renderToStaticMarkup(<PageLayout page={page}>content</PageLayout>);
      expect(html).toContain('class="page-heading-mark"');
      expect(html).toContain('class="page-heading-eyebrow"');
      expect(html).toContain(uiConfig.pages[page].eyebrow);
    }
  });
});
