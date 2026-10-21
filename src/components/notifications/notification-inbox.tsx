import Link from "next/link";
import { OperationForm } from "@/components/workspaces/workspace-forms";
import type { DataPage } from "@/domain/contracts";

export function NotificationInbox({
  data,
  roles,
}: {
  data: DataPage;
  roles: string[];
}) {
  const base = roles.some((role) =>
    ["area_manager", "store_operations"].includes(role),
  )
    ? "/admin/approvals"
    : "/store/operations";
  const unread = data.rows.filter((row) => !row.read_at).length;
  return (
    <section
      className="page-panel"
      aria-labelledby="notification-inbox-heading"
    >
      <div className="panel-head">
        <h2 id="notification-inbox-heading">通知・お知らせ</h2>
        <span className="status">表示中の未読 {unread}件</span>
      </div>
      {!data.rows.length && <p>現在、個人宛の通知はありません。</p>}
      {data.rows.map((row) => (
        <article className="instruction-card" key={row.id}>
          <span className="status">{row.read_at ? "既読" : "未読"}</span>
          <h3>{String(row.title)}</h3>
          <p className="muted">
            {new Date(String(row.created_at)).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
            （日本時間）
          </p>
          <p className="instruction-message">{String(row.message)}</p>
          <div className="button-row">
            {typeof row.correction_id === "string" && (
              <Link
                className="ghost-button"
                href={`${base}?correction=${encodeURIComponent(row.correction_id)}`}
              >
                修正依頼を開く
              </Link>
            )}
            {!row.read_at && (
              <OperationForm operation="markRead" label="既読にする">
                <input type="hidden" name="notificationId" value={row.id} />
              </OperationForm>
            )}
          </div>
        </article>
      ))}
      <p className="muted">
        既読は通知内容の確認です。修正依頼の承認・差戻しは、依頼を開いて実行してください。
      </p>
    </section>
  );
}
