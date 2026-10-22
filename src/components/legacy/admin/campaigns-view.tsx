import { PageLayout } from "@/components/ui/page-layout";

const campaignSummary = [
  {
    id: "CP-2401",
    name: "秋の新商品キャンペーン",
    status: "公開中",
    stores: "全12店舗",
    trend: "+8.4%",
  },
  {
    id: "CP-2402",
    name: "週末特売・まとめ買い",
    status: "準備中",
    stores: "7店舗",
    trend: "要確認",
  },
  {
    id: "CP-2403",
    name: "会員限定クーポン",
    status: "終了予定",
    stores: "3店舗",
    trend: "本日18:00",
  },
];

export default function CampaignsPage() {
  return (
    <PageLayout page="campaigns">
      <section className="page-grid double">
        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>現行キャンペーン</h2>
              <small>対象店舗と売れ筋をまとめて確認</small>
            </div>
          </div>

          <div className="stack-list">
            {campaignSummary.map((campaign) => (
              <div key={campaign.id} className="list-card">
                <div>
                  <strong>{campaign.name}</strong>
                  <small>{campaign.id}</small>
                </div>
                <div className="list-meta">
                  <span>{campaign.stores}</span>
                  <span
                    className={`badge ${campaign.status === "公開中" ? "ok" : campaign.status === "準備中" ? "neutral" : "warning"}`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <span className="muted">{campaign.trend}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>今週の特売計画</h2>
              <small>対象商品と反応率を簡潔に確認</small>
            </div>
          </div>

          <div className="stat-row">
            <div>
              <span>対象商品</span>
              <strong>28件</strong>
            </div>
            <div>
              <span>想定売上</span>
              <strong>¥3,420,000</strong>
            </div>
          </div>

          <div className="chart-bars" aria-label="キャンペーン売上の想定推移">
            {[42, 58, 53, 66, 62, 80, 74].map((value, index) => (
              <div key={`campaign-${index}`} className="bar-wrap">
                <span className="bar" style={{ height: `${Math.max(value, 18)}%` }} />
                <small>{index + 1}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="page-panel">
        <div className="panel-head">
          <div>
            <h2>キャンペーン登録</h2>
            <small>開始日と適用店舗を設定して登録</small>
          </div>
        </div>

        <div className="page-grid double form-grid">
          <label className="field">
            <span>キャンペーン名</span>
            <input value="秋の新商品キャンペーン" readOnly />
          </label>
          <label className="field">
            <span>対象店舗</span>
            <select defaultValue="全店舗">
              <option>全店舗</option>
              <option>東京エリア</option>
              <option>関西エリア</option>
            </select>
          </label>
        </div>

        <div className="page-grid double form-grid-spaced">
          <label className="field">
            <span>開始日</span>
            <input type="date" defaultValue="2026-10-21" />
          </label>
          <label className="field">
            <span>終了日</span>
            <input type="date" defaultValue="2026-11-30" />
          </label>
        </div>

        <div className="button-row form-actions">
          <button type="button" className="primary-button">
            保存する
          </button>
          <button type="button" className="ghost-button">
            下書き保存
          </button>
        </div>
      </section>
    </PageLayout>
  );
}
