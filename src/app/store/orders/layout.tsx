import type { ReactNode } from "react";
import { OrderNavigation } from "@/components/store/order-navigation";
import { PageLayout } from "@/components/ui/page-layout";

export default function StoreOrdersLayout({ children }: { children: ReactNode }) {
  return (
    <PageLayout page="storeOrders">
      <OrderNavigation />
      {children}
    </PageLayout>
  );
}
