# コード案内

「何を変更したいか」からファイルを探すための索引です。全体像は[アーキテクチャ](./architecture.md)、資料の一覧は[資料案内](./index.md)を参照してください。以下のパスはこの文書からの相対リンクです。

## 機能から探す

| 変更したい内容 | 主な画面 | サーバー処理・ルール | 検証 |
|---|---|---|---|
| 店舗ポータルの数値・グラフ | [store](../src/components/store/) | [store-summary.ts](../src/domain/store-summary.ts)、[store-context.ts](../src/server/auth/store-context.ts) | [store-summary.test.ts](../src/domain/store-summary.test.ts)、[store-overview.test.ts](../src/components/store/store-overview.test.ts) |
| 売上修正・承認 | [data-workspace.tsx](../src/components/workspaces/data-workspace.tsx)、[notification-inbox.tsx](../src/components/notifications/notification-inbox.tsx) | [workspace.ts](../src/server/actions/workspace.ts)、PostgreSQLの修正・承認RPC | [database-schema.test.ts](../tests/database-schema.test.ts) |
| 特売の作成・公開・売場作業 | [campaigns](../src/components/campaigns/) | [campaigns.ts](../src/server/actions/campaigns.ts) | [database-schema.test.ts](../tests/database-schema.test.ts)、[connected-workspaces.test.ts](../tests/connected-workspaces.test.ts) |
| 本部の特売・価格変更指示 | [instruction-form.tsx](../src/components/campaigns/instruction-form.tsx)、[instruction-workspace.tsx](../src/components/campaigns/instruction-workspace.tsx) | [instructions.ts](../src/server/actions/instructions.ts)、指示・通知のSQL | [database-schema.test.ts](../tests/database-schema.test.ts) |
| ログイン・パスワード | [auth](../src/components/auth/) | [auth.ts](../src/server/actions/auth.ts)、[admin-access.ts](../src/server/auth/admin-access.ts)、[access-policy.ts](../src/domain/access-policy.ts) | [admin-access.test.ts](../src/server/auth/admin-access.test.ts)、[access-policy.test.ts](../src/domain/access-policy.test.ts) |
| 店舗端末の接続 | [station-form.tsx](../src/components/auth/station-form.tsx) | [station.ts](../src/server/actions/station.ts)、[store-context.ts](../src/server/auth/store-context.ts) | [connected-workspaces.test.ts](../tests/connected-workspaces.test.ts) |
| 商品・店舗・発注・利用者・監査の一覧と入力 | [workspaces](../src/components/workspaces/) | [workspaces.ts](../src/server/queries/workspaces.ts)、[workspace.ts](../src/server/actions/workspace.ts)、[validation.ts](../src/server/validation.ts) | [connected-workspaces.test.ts](../tests/connected-workspaces.test.ts) |
| CSV取込 | [sales-import-form.tsx](../src/components/workspaces/sales-import-form.tsx) | [sales-import.ts](../src/server/actions/sales-import.ts)、[imports](../src/server/imports/) | [canonical-import.test.ts](../src/server/imports/canonical-import.test.ts) |
| POS・基幹との受信・送信 | [api/integrations](../src/app/api/integrations/) | [worker.ts](../src/server/integrations/worker.ts)、[http-transport.ts](../src/infrastructure/integrations/http-transport.ts)、[integration-store.ts](../src/infrastructure/supabase/integration-store.ts) | [worker.test.ts](../src/server/integrations/worker.test.ts)、[connected-workspaces.test.ts](../tests/connected-workspaces.test.ts) |
| 営業日・税計算 | 各業務画面 | [sales.ts](../src/domain/sales.ts)、DB側の業務関数 | [sales.test.ts](../src/domain/sales.test.ts)、DBテスト |
| 未接続時の操作例 | [preview](../src/components/preview/) | [mocks](../src/mocks/) | [workspaces.test.ts](../src/mocks/workspaces.test.ts)、[corrections.test.ts](../src/mocks/corrections.test.ts) |
| 共通の見た目・サイドバー | [layout](../src/components/layout/)、[ui](../src/components/ui/) | [ui.ts](../src/config/ui.ts)、[globals.css](../src/app/globals.css) | [ui.test.ts](../src/config/ui.test.ts) |

## 接続先を変更するとき

1. [domain/contracts.ts](../src/domain/contracts.ts) で画面・業務処理が必要とする契約を確認します。
2. [infrastructure](../src/infrastructure/) に契約を満たす接続実装を置きます。
3. [server/container.ts](../src/server/container.ts) で使用する実装を選びます。
4. 業務条件・認可・データ照合をテストします。DB変更時は[マイグレーション方針](./data-migrations.md)にも従います。

`supabase/clients/server.ts` は個人セッション、`admin.ts` は限定用途のサーバー管理権限、`browser.ts` は公開可能なブラウザ設定です。名前が似ていますが権限と用途が異なります。

## DB側を探す

ローカルの補助スクリプトは [scripts](../scripts/)、架空のCSV例は [public/samples](../public/samples/) に配置します。実環境への適用はスクリプトの内容と対象環境を確認し、DB変更・配備の運用手順に従います。

テーブル、RLS、RPC、監査・通知トリガーは [supabase/migrations](../supabase/migrations/) が正本です。TypeScriptの [adapter.ts](../src/infrastructure/supabase/adapter.ts) がリソース名・操作名をテーブル・RPCへ対応付けます。金額や承認の変更は画面・Server Actionだけで完結させず、SQLとそのDBテストを併せて確認します。

## 互換用コード

[components/legacy](../src/components/legacy/) は旧画面の実装です。現行の通常入口は `app/` から参照される画面を基準にします。[server/actions/compatibility.ts](../src/server/actions/compatibility.ts) と [server/queries/compatibility.ts](../src/server/queries/compatibility.ts) は旧画面向けの接続口です。新規機能は通常の機能別Server Action・Repository契約を使用します。互換コードの廃止は参照と画面受入を確認して別途行います。

## 新しい機能を追加するとき

URLは `app/`、画面は `components/<機能>/`、保存操作は `server/actions/`、取得手順は `server/queries/` に配置します。接続と独立した業務計算・型は `domain/`、接続実装は `infrastructure/`、表示設定は `config/`、架空データは `mocks/` に置きます。テストは対象コードの隣、DB・構成横断テストは `tests/` に配置します。
