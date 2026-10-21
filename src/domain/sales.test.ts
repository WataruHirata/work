import { describe, expect, it } from "vitest";
import { calculateTaxIncludedTotal, getBusinessDate } from "@/domain/sales";

describe("getBusinessDate", () => {
  it("assigns overnight sales before the store cutoff to the previous business day", () => {
    expect(
      getBusinessDate({
        timestamp: "2026-10-20T20:59:00.000Z",
        timeZone: "Asia/Tokyo",
        businessDayStartsAt: "06:00",
      }),
    ).toBe("2026-10-20");
  });

  it("assigns sales at the store cutoff to the current business day", () => {
    expect(
      getBusinessDate({
        timestamp: "2026-10-20T21:00:00.000Z",
        timeZone: "Asia/Tokyo",
        businessDayStartsAt: "06:00",
      }),
    ).toBe("2026-10-21");
  });

  it("honors the standard store's 22:30 local cutoff", () => {
    expect(
      getBusinessDate({
        timestamp: "2026-10-20T13:29:00.000Z",
        timeZone: "Asia/Tokyo",
        businessDayStartsAt: "22:30",
      }),
    ).toBe("2026-10-19");
    expect(
      getBusinessDate({
        timestamp: "2026-10-20T13:30:00.000Z",
        timeZone: "Asia/Tokyo",
        businessDayStartsAt: "22:30",
      }),
    ).toBe("2026-10-20");
  });

  it("uses the store time zone when the UTC date differs", () => {
    expect(
      getBusinessDate({
        timestamp: "2026-10-20T23:30:00.000Z",
        timeZone: "Asia/Tokyo",
        businessDayStartsAt: "00:00",
      }),
    ).toBe("2026-10-21");
  });
});

describe("calculateTaxIncludedTotal", () => {
  it("applies the configured included-tax percentage and rounds down fractional yen", () => {
    expect(
      calculateTaxIncludedTotal([{ unitPrice: 101, quantity: 1 }], 8),
    ).toBe(109);
    expect(
      calculateTaxIncludedTotal([{ unitPrice: 101, quantity: 1 }], 10),
    ).toBe(111);
  });

  it("rejects invalid amounts rather than silently calculating them", () => {
    expect(() =>
      calculateTaxIncludedTotal([{ unitPrice: -1, quantity: 1 }], 8),
    ).toThrow(RangeError);
    expect(() =>
      calculateTaxIncludedTotal([{ unitPrice: 100, quantity: 1 }], 5),
    ).toThrow(RangeError);
  });
});
