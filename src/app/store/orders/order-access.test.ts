import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("発注の店舗端末アクセス", () => {
  it("画面読込は管理ログインではなく登録店舗端末を使用する", () => {
    const source = readFileSync("src/app/store/orders/order-page-data.ts", "utf8");
    expect(source).toContain("deviceToken()");
    expect(source).toContain("storeDeviceOrderWorkspace(token)");
    expect(source).not.toContain("identity().session");
    expect(source).not.toContain("/login");
    expect(source).not.toContain("/account/password");
  });

  it("発注保存は管理ログインやロールではなく登録店舗端末を検証する", () => {
    const source = readFileSync("src/server/actions/workspace.ts", "utf8");
    const createOrder = source.slice(
      source.indexOf('case "createOrder"'),
      source.indexOf('case "markRead"'),
    );
    expect(createOrder).toContain("deviceToken()");
    expect(createOrder).toContain("storeDeviceCreateOrder");
    expect(createOrder).not.toContain("identity().session");
    expect(createOrder).not.toContain("requireRoles");
  });

  it("模擬基幹の結果画面も登録店舗端末だけで表示する", () => {
    const source = readFileSync("src/app/store/orders/mock-core/page.tsx", "utf8");
    expect(source).toContain("deviceSnapshot()");
    expect(source).not.toContain("identity().session");
    expect(source).not.toContain("/login");
  });
});
