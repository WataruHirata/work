const supplierPrefixes = [
  "あおば",
  "ひかり",
  "北斗",
  "清流",
  "みなと",
  "こもれび",
  "朝凪",
  "大地",
  "白樺",
  "つばさ",
] as const;

const supplierSpecialties = ["食品卸", "生鮮流通", "飲料販売", "日用品商事", "冷凍物流"] as const;

export const fictionalOrderSuppliers = supplierPrefixes.flatMap((prefix) =>
  supplierSpecialties.map((specialty) => `${prefix}${specialty}`),
);

export function fictionalSupplierForProduct(productCode: string) {
  let hash = 0;
  for (const character of productCode) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return fictionalOrderSuppliers[hash % fictionalOrderSuppliers.length];
}
