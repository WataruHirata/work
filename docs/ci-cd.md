# CI/CD・リリース方針

## 現在構築済みのCI

`.github/workflows/ci.yml` はPRとmainへのpushで、アプリのlint、型検査、ユニットテスト、本番ビルド、要件トレーサビリティ検査、ローカルSupabaseへの全マイグレーション適用・スキーマLintを実行する。チェックアウト以外の権限は付与しない。Vercel Git連携のPR Previewはプレビュー用途で、Productionデプロイとは分離する。

## 本番自動デプロイ

同ワークフローの `deploy-production` は、mainへのpush、前段CIの全成功、リポジトリ変数 `ENABLE_PRODUCTION_DEPLOY=true` と `APP_RELEASE_READY=true` を満たした場合だけ動く。招待制ログインと初期アクセスガードは実装済みだが、現在の画面はデモ用で、実データ接続・ロール管理・全業務機能は未完成のため、業務機能と本番運用が受入されるまで両変数を有効にしない。GitHubの `production` environmentで必須レビュアーを設定し、以下を登録する。

| 種類     | 名前                    | 内容                                     |
| -------- | ----------------------- | ---------------------------------------- |
| Secret   | `SUPABASE_ACCESS_TOKEN` | Supabase CLI用アクセストークン           |
| Secret   | `SUPABASE_DB_PASSWORD`  | 対象プロジェクトのDBパスワード           |
| Variable | `SUPABASE_PROJECT_ID`   | Supabase project ref                     |
| Secret   | `VERCEL_TOKEN`          | 対象プロジェクトに制限したVercelトークン |
| Variable | `VERCEL_ORG_ID`         | Vercel team/user ID                      |
| Variable | `VERCEL_PROJECT_ID`     | Vercel project ID                        |

また、リポジトリ変数 `ENABLE_PRODUCTION_DEPLOY=true` と `APP_RELEASE_READY=true` を登録する。後者は実データ接続、利用者・ロール管理、業務受入、セキュリティ・運用確認が完了し、本番リリースを承認した後にのみ有効にする。初期状態では未設定とし、Productionデプロイは無効。

順序は **本番スキーママイグレーション → Vercel production build/deploy**。設定が欠けている場合はデプロイ前にエラーで停止する。GitHub Environmentの承認者と環境保護はGitHub UIで設定し、必須化する。

Vercel Project SettingsではProduction Branchからの自動Production deploymentを無効化し、GitHub Actionsの統制されたデプロイと二重化・競合しないようにする。PR PreviewのGit連携は有効なままにし、VercelのDeployment ChecksでCI必須化を設定する。これらのプロジェクト設定はこのリポジトリから自動変更できない。

自動マイグレーションを有効化する前に、Supabase本番プロジェクトで初期スキーマが未使用・新規であることを確認する。既存の本番DBへ初期マイグレーションをそのまま適用しない。

## 技術スタック決定後に必須化するゲート

PRの必須ステータスチェックとして、以下をプロジェクト技術に合うコマンドで順次追加する。

1. フォーマット検査、lint、型検査、依存関係・シークレット・ライセンス検査。
2. 単体・統合・DBマイグレーション・API契約テスト。
3. ビルド、UI/E2E、アクセシビリティと reduced-motion 検証。
4. 要件トレーサビリティと受入試験、必要なセキュリティ・性能試験。
5. 依存の固定、ロックファイルと環境再現性の検証。

失敗を許容する必須ゲートや、理由のないスキップを作らない。テストデータは架空データを用いる。

## PR・レビュー・マージ

- 変更内容、関連要件、テスト結果、DB/IF/権限/UX影響、ロールバックをPRに記載する。
- CI成功とコード所有者によるレビューを必須にする。承認数、CODEOWNERS、ブランチ保護はGitHub環境と担当者確定後に設定する。
- mainへの直接pushを禁止し、必要なら署名付きコミット・線形履歴の要否をチーム規約として合意する。
- 仕様・権限・データ移行・本番操作など高リスク変更は、業務オーナーまたは運用責任者の明示承認を追加する。

## リリース・デプロイ

ホスティング先はVercel、DBはSupabaseの初期構成を採用した。Production workflowの有効化に必要な環境変数・シークレットとGitHub environmentの承認者は未設定の可能性があるため、登録後にのみ自動デプロイを有効化する。

- 開発・検証・ステージング・本番のデータと権限を分離し、PRから本番資格情報へアクセスさせない。
- ステージングでIF、権限、移行、バックアップ、監視を検証し、段階導入・機能フラグを使う。
- DBマイグレーションとアプリの順序、互換期間、切戻し条件をリリースごとに記録する。
- 先行10店舗で承認済み成功基準を満たした後に全店展開する。
- デプロイ後確認、異常時の停止・切戻し、連絡網、リリースノート、担当を記録する。

## 未決事項

承認者、レビュー人数、ブランチ保護、環境、デプロイ方式、段階リリース、承認済み成功基準は [未決事項一覧](./open-questions.md) で管理する。曖昧なままワークフローに仮の本番操作を実装しない。
