import { PageLayout } from "@/components/ui/page-layout";
import { OrderEntry } from "@/components/store/order-workspace";
import { orderPageData } from "../order-page-data";

export default async function NewStoreOrderPage() {
  const { catalog, departmentId, requestId, storeId } = await orderPageData();
  return (
    <PageLayout page="storeOrders">
      <OrderEntry
        catalog={catalog}
        departmentId={departmentId}
        requestId={requestId}
        storeId={storeId}
      />
    </PageLayout>
  );
}
