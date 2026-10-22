import { describe, expect, it } from "vitest";
import { canonicalSalesRows, parseCsv } from "@/server/imports/canonical-import";
import { integer, parseMaster, date } from "@/server/validation";
describe("AT-01/06/10 入力検証", () => {
  it("CSVの引用符・カンマ・改行・BOMを正しく読み込む", () => {
    expect(parseCsv('\uFEFFcode,name\r\nA,"Fictional, \"\"item\"\"\nsecond line"\r\n')).toEqual([
      { code: "A", name: 'Fictional, "item"\nsecond line' },
    ]);
    expect(() => parseCsv("a,a\n1,2")).toThrow();
    expect(() => parseCsv('a,b\n"unclosed,2')).toThrow();
    expect(() => parseCsv("a,b\n1,2,3")).toThrow();
  });
  it("税率9%・精度を超える金額・不正日付・曖昧な日時を拒否する", () => {
    const data = new FormData();
    data.set("code", "MOCK");
    data.set("name", "Fictional");
    data.set("tax_rate", "9");
    data.set("active", "true");
    expect(() => parseMaster("products", data)).toThrow("税率");
    expect(() => integer("9007199254740992")).toThrow();
    expect(() => date("2026-02-30")).toThrow();
    const header =
      "store_code,product_code,department_code,business_date,transaction_time,source_row_key,receipt_key,customer_count,quantity,amount_yen,tax_rate,line_type\n";
    expect(() =>
      canonicalSalesRows(
        header + "DEMO-001,MOCK,DEPT,2020-01-01,2020-01-01T23:00:00,key,receipt,1,1,100,8,sale",
      ),
    ).toThrow("日時");
    expect(() =>
      canonicalSalesRows(
        header +
          "DEMO-001,MOCK,DEPT,2020-01-01,2020-01-01T23:00:00+09:00,key,receipt,1,1,-100,8,sale",
      ),
    ).toThrow("符号");
  });
});
