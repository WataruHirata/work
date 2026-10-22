import { StateBadge } from "@/components/ui/state-badge";
import type { DataRecord } from "@/domain/contracts";

const yen = (value: unknown) =>
  `${Number(value ?? 0).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}円`;

export function CorrectionRequestStatus({
  corrections,
  salesDays,
}: {
  corrections: DataRecord[];
  salesDays: DataRecord[];
}) {
  const salesById = new Map(salesDays.map((row) => [row.id, row]));
  const pending = corrections.filter((row) => String(row.status).startsWith("pending_")).length;

  return (
    <section
      className="page-panel correction-request-status"
      aria-labelledby="correction-status-title"
    >
      <div className="panel-head">
        <div>
          <h2 id="correction-status-title">売上修正依頼の申請状況</h2>
        </div>
        <StateBadge
          state={pending ? "pending" : "completed"}
          label={pending ? `承認待ち ${pending}件` : "承認待ちなし"}
        />
      </div>
      {corrections.length ? (
        <div className="correction-status-list">
          {corrections.map((correction) => {
            const salesDay = salesById.get(String(correction.sales_day_id));
            return (
              <article className="correction-status-card" key={correction.id}>
                <div className="correction-status-heading">
                  <div>
                    <strong>{String(salesDay?.business_date ?? "営業日不明")}</strong>
                    <span className="muted">
                      申請日時: {new Date(String(correction.requested_at)).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <StateBadge state={String(correction.status)} />
                </div>
                <p>{String(correction.reason)}</p>
                <p className="correction-amount">
                  {yen(correction.before_amount_yen)}
                  <span aria-hidden="true">→</span>
                  <strong>{yen(correction.after_amount_yen)}</strong>
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">この店舗から本部へ申請した売上修正依頼はありません。</p>
      )}
    </section>
  );
}
