import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { COLLAPSED_ROW_COUNT, visibleTableRows } from "./collapsible-table";

const rows = Array.from({ length: 5 }, (_, index) => createElement("tr", { key: index }));

describe("collapsible table", () => {
  it("shows only the first three rows while collapsed", () => {
    expect(COLLAPSED_ROW_COUNT).toBe(3);
    expect(visibleTableRows(rows, false)).toHaveLength(3);
  });

  it("shows every row while expanded", () => {
    expect(visibleTableRows(rows, true)).toHaveLength(5);
  });
});
