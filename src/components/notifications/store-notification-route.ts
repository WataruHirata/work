const notificationDestinations = [
  {
    pattern: /特売|価格|値札|POP|POS/,
    href: "/store/campaigns",
    label: "特売・価格を開く",
  },
  { pattern: /売上|修正/, href: "/store/sales", label: "売上を開く" },
  { pattern: /在庫|棚卸|冷蔵|冷凍/, href: "/store/inventory", label: "在庫を開く" },
  { pattern: /発注|納品/, href: "/store/orders", label: "発注を開く" },
] as const;

export function storeNotificationDestination(title: string, message: string) {
  const content = `${title} ${message}`;
  return (
    notificationDestinations.find(({ pattern }) => pattern.test(content)) ?? {
      href: "/store/notices",
      label: "お知らせを開く",
    }
  );
}
