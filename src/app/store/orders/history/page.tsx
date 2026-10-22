import { PageLayout } from "@/components/ui/page-layout";
import { OrderHistory } from "@/components/store/order-workspace";
import { orderPageData } from "../order-page-data";

export default async function StoreOrderHistoryPage() {
  const { history } = await orderPageData();
  return (
    <PageLayout page="storeOrders">
      <OrderHistory history={history} />
    </PageLayout>
  );
}
