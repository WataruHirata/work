"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/store/orders/new", label: "発注入力" },
  { href: "/store/orders/history", label: "発注履歴" },
] as const;

export function OrderNavigation() {
  const pathname = usePathname();
  return (
    <nav className="order-navigation" aria-label="発注画面の切り替え">
      <div className="order-navigation-tabs">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              className={active ? "primary-button" : "ghost-button"}
              href={tab.href}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <Link
        className={pathname === "/store/orders/mock-core" ? "primary-button" : "ghost-button"}
        href="/store/orders/mock-core"
        aria-current={pathname === "/store/orders/mock-core" ? "page" : undefined}
      >
        基幹の受信結果
      </Link>
    </nav>
  );
}
