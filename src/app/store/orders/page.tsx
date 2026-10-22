import { OrderHome } from "@/components/store/order-workspace";
import { orderPageData } from "./order-page-data";

export default async function StoreOrdersPage() {
  const { history } = await orderPageData();
  return <OrderHome history={history.slice(0, 5)} />;
}
