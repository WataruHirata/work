# 開発ガイドライン

## 基本ルール

- [要件定義書](./みのり屋_販売管理システム_要件定義書_最終統合完全版.md)を業務要件の一次資料とする。`[要確認]`・`[提案]`を独断で確定要件にしない。
- 既存POS・基幹システムの全面置換、未確定の発注連携、外部IF、保存期間、SLAを暗黙に実装しない。判断が必要なら [未決事項一覧](./docs/open-questions.md) を更新する。
- 変更前に関連実装、テスト、設計、既存パターンを確認し、必要な範囲だけを変更する。無関係な整形・変更を混ぜない。
- 要件IDから実装・テストまで追跡できるようにし、仕様変更時は要件、設計、テスト、運用資料を一緒に更新する。
- 金額、権限、承認、締め、税、返品、監査、データ移行は高リスク領域として扱い、根拠のあるテストなしに挙動を変更しない。

## UX/UI

- [UI・アニメーション方針](./docs/ui-motion.md)に従う。滑らかな画面遷移・操作フィードバック・データ連動インフォグラフィックを活用し、業務の正確さ、低負荷、読みやすさを損なわない。
- `prefers-reduced-motion`を尊重し、動きがなくても全情報と状態が理解できるようにする。点滅・自動再生・アニメーションだけに依存する意味表現は禁止する。
- 店舗の共用PC、キーボード操作、フォーカス、エラー回復、表示倍率を考慮する。重要な金額操作では操作者の個人識別と監査要件を守る。

## データ・セキュリティ

- DB採用後は [マイグレーション方針](./docs/data-migrations.md) に従い、前進・ロールバック、データ照合、段階展開を検証する。手作業の本番スキーマ変更を行わない。
- 秘密情報、実データ、個人情報をソース、ログ、テストfixture、AIへの入力に含めない。サンプルデータは架空データを使う。
- 権限は最小限とし、店舗・エリア・担当売場の境界をサーバー側で検査する。クライアント表示だけでアクセスを制御しない。

## 検証と完了条件

- [テスト方針](./docs/testing.md)を参照し、変更に対応する最小の関連テストを追加・実行する。
- 完了報告には変更内容、実行した検証と結果、未解決事項を含める。実行していないテストを成功と表現しない。
- 受入条件に影響する変更は、該当する要件・受入試験IDをPRに記載する。
- PRは [PRテンプレート](./.github/PULL_REQUEST_TEMPLATE.md) に沿い、CI成功と必要なレビュー承認を得る。

## 技術基盤

初期実装はNext.js App Router、TypeScript、Node.js 22、Supabase PostgreSQL、Vercelを使う（[ADR-0001](./docs/adr/0001-platform.md)）。依存パッケージを追加・更新した場合はlockfileも更新する。DB変更はSupabase CLIの版管理マイグレーションを使用する。

Supabaseの `service_role` key、アクセストークン、DBパスワードはサーバーやGitHub Environment以外に露出させない。ブラウザには公開可能なSupabase URL/anon keyだけを用い、RLSを無効化しない。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
