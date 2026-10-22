"use server";

import { identity, repository } from "@/server/container";
import type { DataRecord } from "@/domain/contracts";
import { deviceToken } from "@/server/auth/store-context";

export async function loadSalesDayLines(salesDayId: string): Promise<DataRecord[]> {
  if (!/^[0-9a-f-]{36}$/i.test(salesDayId)) throw new Error("売上日を確認できません。");
  const session = await identity().session();
  const token = await deviceToken();
  if (token) return repository().storeDeviceSalesDayLines(token, salesDayId);
  if (session?.active && !session.mustChangePassword && session.storeIds?.length) {
    const lines: DataRecord[] = [];
    for (let page = 1; page <= 200; page++) {
      const result = await repository().list("salesLines", {
        salesDayId,
        storeId: session.storeIds[0],
        page,
      });
      lines.push(...result.rows);
      if (lines.length >= result.total) return lines;
    }
    throw new Error("明細が多いため表示できません。日付を絞ってください。");
  }
  throw new Error("登録端末または店舗権限を確認できません。");
}
