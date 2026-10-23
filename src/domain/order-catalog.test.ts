import { describe, expect, it } from "vitest";
import { fictionalOrderSuppliers, fictionalSupplierForProduct } from "./order-catalog";

describe("発注カタログ", () => {
  it("1,200商品を50社の架空業者へ分散する", () => {
    const suppliers = new Set(
      Array.from({ length: 1_200 }, (_, index) =>
        fictionalSupplierForProduct(`FIXTURE-SCALE-${String(index + 1).padStart(4, "0")}`),
      ),
    );

    expect(fictionalOrderSuppliers).toHaveLength(50);
    expect(suppliers).toEqual(new Set(fictionalOrderSuppliers));
  });
});
