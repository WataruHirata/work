import { FeatureNotice } from "@/components/ui/feature-notice";
import { OrderEntry } from "@/components/store/order-workspace";
import { orderPageData } from "../order-page-data";

export default async function NewStoreOrderPage() {
  const { catalog, departmentId, requestId, storeId, canCreateOrder, unavailableReason } =
    await orderPageData();
  return canCreateOrder && departmentId && storeId ? (
    <OrderEntry
      catalog={catalog}
      departmentId={departmentId}
      requestId={requestId}
      storeId={storeId}
    />
  ) : (
    <FeatureNotice title="発注入力を利用できません">
      {unavailableReason ?? "担当店舗と権限を確認してください。"}
    </FeatureNotice>
  );
}
