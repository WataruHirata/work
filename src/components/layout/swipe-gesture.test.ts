import { describe, expect, it } from "vitest";
import { resolveSwipeAction } from "@/components/layout/swipe-gesture";

describe("AT-10 モバイルのスワイプ操作", () => {
  it("左端からの右スワイプでメニューを開き、メニュー内の左スワイプで閉じる", () => {
    expect(
      resolveSwipeAction({
        startX: 8,
        startY: 220,
        endX: 100,
        endY: 230,
        viewportWidth: 390,
        drawerOpen: false,
        startedInDrawer: false,
      }),
    ).toBe("open-menu");
    expect(
      resolveSwipeAction({
        startX: 180,
        startY: 220,
        endX: 80,
        endY: 226,
        viewportWidth: 390,
        drawerOpen: true,
        startedInDrawer: true,
      }),
    ).toBe("close-menu");
  });

  it("縦スクロールに近い動きやデスクトップではスワイプ動作しない", () => {
    expect(
      resolveSwipeAction({
        startX: 8,
        startY: 100,
        endX: 80,
        endY: 210,
        viewportWidth: 390,
        drawerOpen: false,
        startedInDrawer: false,
      }),
    ).toBeNull();
    expect(
      resolveSwipeAction({
        startX: 8,
        startY: 100,
        endX: 100,
        endY: 102,
        viewportWidth: 1280,
        drawerOpen: false,
        startedInDrawer: false,
      }),
    ).toBeNull();
  });
});
