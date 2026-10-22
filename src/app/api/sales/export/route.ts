import { NextResponse } from "next/server";
import { repository } from "@/server/container";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  if (!from || !to) {
    return NextResponse.json({ error: "from と to は必須です" }, { status: 400 });
  }

  const result = await repository().list("sales", { storeId, from, to, page: 1 });
  const rows = [
    ["営業日", "売上", "客数", "状態"],
    ...result.rows.map((row) => [
      String(row.business_date ?? ""),
      String(row.net_sales_yen ?? 0),
      String(row.customer_count ?? 0),
      String(row.status ?? ""),
    ]),
  ];

  const csv = rows
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales_${from}_${to}.csv"`,
    },
  });
}
