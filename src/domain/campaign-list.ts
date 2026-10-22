export function filterCampaigns<T extends { name: string; status: string; storeIds: string[] }>(
  campaigns: readonly T[],
  search: string,
  status: string,
  storeId = "",
): T[] {
  const query = search.trim().toLocaleLowerCase("ja-JP");
  return campaigns.filter(
    (campaign) =>
      (!query || campaign.name.toLocaleLowerCase("ja-JP").includes(query)) &&
      (!status || campaign.status === status) &&
      (!storeId || campaign.storeIds.includes(storeId)),
  );
}
