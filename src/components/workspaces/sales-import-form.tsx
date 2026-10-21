"use client";
import { useActionState } from "react";
import { importSalesCsv } from "@/server/actions/sales-import";
import { Feedback } from "@/components/workspaces/workspace-forms";
export function SalesImportForm() {
  const [state, action, pending] = useActionState(importSalesCsv, {});
  return <form action={action} className="workspace-form"><label className="field"><span>標準形式の売上CSV（最大5MB・10,000明細）</span><input type="file" name="file" accept=".csv" required /></label><a className="ghost-button" href="/samples/sales-import.csv" download>入力サンプルを取得</a><button className="primary-button" type="submit" disabled={pending}>{pending ? "検査・取込中…" : "検査して取り込む"}</button><Feedback state={state} /></form>;
}
