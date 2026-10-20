# ADR-0001: Vercel・Next.js・Supabaseを初期アプリ基盤に採用

- 状態: 承認済み（初期実装の暫定採用）
- 日付: 2026-10-20
- 判断者: プロジェクト実装担当
- 関連要件・未決事項: NFR-001〜NFR-011、Q-01〜Q-14、C-01〜C-10

## 背景

要件定義書にはVercel接続済みとの利用者申告があるが、フロントエンド技術、DB、認証方式、POS・基幹IF仕様は記載されていない。PR検証と安全なリリース手順を具体化するため、追加の回答を待たず最小の実装基盤が必要である。

## 判断

- WebアプリはNext.js App RouterとTypeScriptを使い、Node.js 22を実行基盤とする。
- 配置先はVercelとする。
- PostgreSQLと認証の初期統合先としてSupabaseを採用し、スキーマは `supabase/migrations/` で管理する。
- VercelのPR Previewは接続済みGit連携を利用する。ProductionはGitHub Actionsからのみデプロイし、DBマイグレーションの成功後に実行する。
- Supabase認証・本番データ接続はプロジェクト設定後に有効化する。デモUIの架空データを実データと表示しない。

## 根拠・検討した選択肢

利用者がVercelを指定しているため、同プラットフォームに自然に配置できるNext.jsを採用した。Supabaseは管理PostgreSQLと認証を一体で提供し、マイグレーション・RLSをリポジトリに含められる。業務規模・セキュリティ・費用・運用SLAの正式評価は要確認であり、今回の選択を最終的な非機能要件承認とはみなさない。

## 結果・移行

- PR CIはlint、型検査、単体テスト、ビルド、ローカルSupabaseへのマイグレーション適用・Lintを行う。
- Production deployは `ENABLE_PRODUCTION_DEPLOY=true` とGitHub `production` environmentの構成がそろうまで無効。
- 本番移行前にSupabaseのバックアップ、移行差分、RLS、Vercel環境変数、復旧手順を確認する。
- Git連携の自動Production deploymentは無効化し、GitHub Actionsからのデプロイに一本化する。PR Previewの設定は維持する。
- 将来プラットフォームを変更する場合はADRを置き換え、DB・認証・デプロイ・移行計画を再評価する。
