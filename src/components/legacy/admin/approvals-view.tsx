"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { useEffect, useState } from "react";
import { submitApprovalDecision } from "@/server/actions/compatibility";

type CorrectionRow = {
  id: string;
  sales_day_id: string;
  reason: string;
  before_amount_yen: number;
  after_amount_yen: number;
  status: string;
  requested_at: string;
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadApprovals() {
      try {
        const res = await fetch("/api/dashboard", {
          headers: { "x-api-key": process.env.NEXT_PUBLIC_MOCK_API_KEY ?? "minoriya-demo-key" },
        });
        const json: { data?: { approvals?: (Partial<CorrectionRow> & { name?: string })[] } } = await res.json();
        const approvalsFromApi = json.data?.approvals ?? [];
        setApprovals(
          approvalsFromApi.map((item, index) => ({
            id: item.id ?? `${index}`,
            sales_day_id: item.sales_day_id ?? `${index}`,
            reason: item.reason ?? item.name ?? "修正承認",
            before_amount_yen: item.before_amount_yen ?? 0,
            after_amount_yen: item.after_amount_yen ?? 0,
            status: item.status ?? "pending_area_approval",
            requested_at: item.requested_at ?? new Date().toISOString(),
          })),
        );
      } catch {
        setError("承認データを取得できませんでした。");
      } finally {
        setLoading(false);
      }
    }

    loadApprovals();
  }, []);

  const resolveApproval = async (id: string, approved: boolean) => {
    try {
      await submitApprovalDecision({ correctionId: id, approved, comment: approved ? "承認済み" : "差戻し" });
      setApprovals((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認処理に失敗しました");
    }
  };

  return (
    <PageLayout page="approvals">

      <section className="page-panel">
        <div className="panel-head">
          <div>
            <h2>承認待ち一覧</h2>
            <small>一次承認・最終承認・差戻しを進める</small>
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}
        {loading ? (
          <p className="muted">承認データを読み込み中…</p>
        ) : (
          <div className="stack-list">
            {approvals.length === 0 ? (
              <p className="muted">承認待ちの修正はありません。</p>
            ) : (
              approvals.map((item) => (
                <div key={item.id} className="list-card">
                  <div>
                    <strong>{item.reason}</strong>
                    <small>{new Date(item.requested_at).toLocaleString("ja-JP")}</small>
                  </div>
                  <div className="list-meta">
                    <span>¥{Number(item.after_amount_yen ?? 0).toLocaleString()}</span>
                    <span className="badge warning">{item.status}</span>
                  </div>
                  <div className="button-row">
                    <button type="button" className="primary-button small" onClick={() => resolveApproval(item.id, true)}>承認</button>
                    <button type="button" className="danger-button small" onClick={() => resolveApproval(item.id, false)}>差戻し</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
