import { OrderHistory } from "@/components/store/order-workspace";
import { orderPageData } from "../order-page-data";

export default async function StoreOrderHistoryPage() {
  const { history } = await orderPageData();
  return <OrderHistory history={history} />;
}
