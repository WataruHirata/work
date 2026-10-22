import { PageLayout } from "@/components/ui/page-layout";
import { OrderHome } from "@/components/store/order-workspace";
import { orderPageData } from "./order-page-data";

export default async function StoreOrdersPage() {
  const { history } = await orderPageData();
  return (
    <PageLayout page="storeOrders">
      <OrderHome history={history.slice(0, 5)} />
    </PageLayout>
  );
}
