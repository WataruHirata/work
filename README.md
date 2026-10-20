# みのり屋 販売管理システム

112店舗のPOS売上取込、営業日判定、締め・修正承認を中核とする販売管理システムの開発リポジトリです。既存POS・基幹システムは原則維持し、店舗ごとの業務差を設定で扱う方針です。

## 現在の状態

このリポジトリにはNext.js/TypeScriptの初期アプリ、Supabase向けDBマイグレーション、Vercel/GitHub Actionsデリバリーハーネスが含まれます。初期技術選択は [ADR-0001](./docs/adr/0001-platform.md) を参照してください。外部IF仕様、運用SLA、Vercel/Supabase本番設定は別途確認が必要です。

招待制ログインと初期アクセスガード、特売の下書き・店舗別進捗を扱う初期画面/DB基盤を実装しています。Supabase環境変数がないローカル/Preview環境では架空データのダッシュボードと、永続化操作を無効にした特売プレビューを表示します。Vercel ProductionではSupabase未設定のままアプリを提供しません。商品本部のEDLP確認データ、POS/基幹連携、売上業務画面などは未完成のため、本番リリースはまだ有効化しないでください。

## 最初に読む資料

1. [要件定義書](./みのり屋_販売管理システム_要件定義書_最終統合完全版.md) — 業務要件、受入条件、矛盾、未確定事項の一次資料
2. [AGENTS.md](./AGENTS.md) — AIエージェントと開発者が常に守る作業ルール
3. [システム設計方針](./docs/architecture.md) — 要件から導いた境界と、決定待ちの設計
4. [未決事項一覧](./docs/open-questions.md) — 着手・リリースを妨げる判断事項と担当
5. [CI/CD方針](./docs/ci-cd.md) — PR検証、本番移行・Vercelデプロイの順序と必要な環境設定
6. [実装ロードマップ](./docs/implementation-roadmap.md) — 実装済み範囲、未実装機能、外部仕様待ち

## ハーネスの検証

Node.js 22、npm、Docker、Supabase CLIを用意します。依存関係をインストールして検証します。

```powershell
npm install
npm run lint
npm run typecheck
npm test
npm run build
supabase start -x studio,inbucket,edge-runtime,logflare,vector
supabase db reset
supabase db lint --local --fail-on error
python -m unittest discover -s tests -v
```

PRではlint、型検査、ユニットテスト、ビルド、DBマイグレーション適用、要件トレーサビリティ検査が自動実行されます。Supabase/VercelのProduction設定を行い、保護されたGitHub `production` environmentからmainをデプロイするときは、DBマイグレーション成功後にVercelへデプロイします。

## 変更の進め方

1. 要件IDと未確定事項を確認し、業務上の曖昧さを勝手に確定しない。
2. 変更と一緒にテスト、要件トレーサビリティ、関連ドキュメントを更新する。
3. PRで影響範囲、検証結果、データ移行・ロールバック、UXの動きと静止表示を説明する。
4. 必須CIと権限を持つ担当者のレビューを通してからマージする。

## ディレクトリ

```text
.
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/ci.yml
├── docs/
│   ├── adr/                 # 承認済みの設計判断と記録用テンプレート
│   ├── implementation-roadmap.md
│   ├── architecture.md
│   ├── ci-cd.md
│   ├── data-migrations.md
│   ├── open-questions.md
│   ├── testing.md
│   ├── ui-motion.md
│   └── security-operations.md
├── src/                     # Next.jsアプリ、業務ロジック、テスト
├── supabase/                # PostgreSQL migrationsと架空のローカルseed
├── tests/                   # 要件トレーサビリティの検査
└── みのり屋_販売管理システム_要件定義書_最終統合完全版.md
```
