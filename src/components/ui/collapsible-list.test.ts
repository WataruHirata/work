import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { COLLAPSED_LIST_COUNT, visibleListItems } from "./collapsible-list";

const items = Array.from({ length: 5 }, (_, index) => createElement("article", { key: index }));

describe("collapsible list", () => {
  it("shows three items while collapsed", () => {
    expect(COLLAPSED_LIST_COUNT).toBe(3);
    expect(visibleListItems(items, false)).toHaveLength(3);
  });

  it("shows all items while expanded", () => {
    expect(visibleListItems(items, true)).toHaveLength(5);
  });
});
