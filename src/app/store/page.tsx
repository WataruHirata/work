import { FeatureMenu } from "@/components/layout/feature-menu";
import { PageLayout } from "@/components/ui/page-layout";
import { uiConfig } from "@/config/ui";

export default function StoreMenuPage() {
  return <PageLayout page="storeMenu"><FeatureMenu pages={uiConfig.navigation} /></PageLayout>;
}
