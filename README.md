# みのり屋 販売管理システム

DB接続・モック利用者の準備・実操作の起動手順は [接続手順書](./docs/connected-backend.md)、API提供側の要件は [外部連携契約](./docs/integration-api.md) を参照してください。参照・保存コードはPostgreSQLへ接続する構成ですが、この作業環境では接続情報未設定のためリモート適用・実ログインは未検証です。

112店舗の売上取込、店舗別営業日、締め・修正承認、特売・価格変更指示、発注・通知を扱う販売管理システムです。業務要件は[統合要件書v3](./みのり屋_販売管理システム_統合要件書_v3.md)の第25章と最新の明示指示を優先します。

## 構成

機能やフォルダーの役割を初めて確認する方は、[非技術者向けの機能・フォルダー案内](./docs/plain-language-guide.md)をご覧ください。店舗・本部で使う機能、申請や通知の流れ、現在試せる範囲を、専門用語を抑えて説明しています。

**Next.js / TypeScript / Node.js 22** で画面とバックエンドを実装し、DB・認証には **Supabase PostgreSQL / Auth** を使用します。一つのアプリの中で役割を分離した構成です。Pythonは要件書の検査にのみ使用します。

```text
src/
├── app/                   # URL・ページ・HTTP API
├── components/            # 画面（認証・店舗・特売・通知などの機能別）
├── domain/                # 業務計算・認可表・型・接続契約
├── server/                # サーバー処理
│   ├── actions/           # 保存・申請・承認などのServer Actions
│   ├── auth/              # セッション・権限・店舗端末
│   ├── queries/           # 取得処理
│   ├── imports/           # CSV・利用者取込
│   ├── integrations/      # 連携ジョブの実行手順
│   ├── container.ts       # 使用するDB・認証・HTTP接続を組み立てる
│   └── validation.ts      # サーバー入力検証
├── infrastructure/        # Supabase・HTTPの具体的な接続
├── config/                # 画面・テーマ設定
└── mocks/                 # 架空データ・操作プレビュー
supabase/                  # DBマイグレーション・ローカルseed
public/samples/            # 架空のCSVサンプル
scripts/                   # デモ環境設定・連携実行の開発補助
tests/                     # DB統合・構成境界・要件書の検査
docs/                      # 要件参照・設計・テスト・運用
```

## 最初に読む資料

開発の知識を前提にしない説明は、[はじめて読む方への案内](./docs/plain-language-guide.md)にまとめています。

1. [資料案内](./docs/index.md) — 目的別の参照先
2. [アーキテクチャ](./docs/architecture.md) — 全体図、各層の責任、データの流れ
3. [コード案内](./docs/code-map.md) — 修正したい機能から実装・テストを探す
4. [画面ルート](./docs/routes.md) — 店舗・本部のURL
5. [開発ルール](./AGENTS.md) — 変更・検証・機密情報の扱い

## 現在の状態

店舗ポータルと店舗機能の入口は公開し、本部機能・重要操作は個人ログインとサーバー・DBの権限制御を通します。接続済みの店舗端末は自店舗の情報を閲覧します。DB未設定時は架空データで操作可能なプレビューを表示します。

本部の特売・価格変更指示と店舗確認、店舗からの売上修正依頼・二段階承認・結果通知の実装を含みます。実環境DBへの適用、実アカウントでの認証E2E、POS・基幹の物理IF、本番の負荷・復旧条件は別途確認が必要です。[未決事項](./docs/open-questions.md)、[v3照合台帳](./docs/requirements-v3-audit.md)、[ロードマップ](./docs/implementation-roadmap.md)を参照してください。

## ローカル起動と検証

Node.js 22とnpmを使用します。設定項目は [.env.example](./.env.example) を参照し、秘密情報はリポジトリに保存しません。

```powershell
npm ci
npm run dev
```

変更後の基本チェック:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
python -m unittest discover -s tests -v
```

DBを検証する場合はDockerとSupabase CLIも用意します。

```powershell
supabase start -x studio,inbucket,edge-runtime,logflare,vector
supabase db reset
supabase db lint --local --fail-on error
```

手順と検証範囲は[テスト方針](./docs/testing.md)、DB変更は[マイグレーション方針](./docs/data-migrations.md)、PR・本番配備は[CI/CD](./docs/ci-cd.md)を参照してください。初期技術基盤の判断は[ADR-0001](./docs/adr/0001-platform.md)に記録しています。
