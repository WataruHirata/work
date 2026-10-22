# みのり屋 販売管理システム

## ローカルMySQLモック：すぐに試す情報

| 用途               | 値                                                                 |
| ------------------ | ------------------------------------------------------------------ |
| アプリ             | `http://localhost:3000`                                            |
| 管理ログイン       | `minoriya-demo+information_systems@example.invalid`                |
| 管理パスワード     | `Demo!4f415f02764eedff91f594ee05862d5e877ba9`                      |
| 管理権限           | `information_systems`                                              |
| 店舗               | `DEMO-001`（架空デモ店舗）                                         |
| 店舗端末接続コード | `6ac6881e515326727cdeb8e78e544d2e575d1f5fb1988c6b604eb357fa6bad69` |
| 売場の例           | `FIXTURE-FOOD`、`FIXTURE-GROCERY`                                  |
| 商品の例           | `FIXTURE-V1-FOOD`、`FIXTURE-V1-DELI`、`FIXTURE-V1-HOME`            |

MySQLのテーブルと架空データを作成するには、`npm run db:mysql:migrate`、続けて `npm run db:mysql:demo` を実行します。

初回起動は下の「はじめてのローカル起動」から始められます。クラウド開発DBへの接続は「ほかの開発者向け Supabase 設定」、操作範囲は [接続手順書](./docs/connected-backend.md)、API提供側の要件は [外部連携契約](./docs/integration-api.md) を参照してください。既存の開発用DBには架空データを登録し、8ロールの実ログインを確認済みです。

112店舗の売上取込、店舗別営業日、締め・修正承認、特売・価格変更指示、発注・通知を扱う販売管理システムです。業務要件は[統合要件書v3](./docs/requirements/みのり屋_販売管理システム_統合要件書_v3.md)の第25章と最新の明示指示を優先します。

## はじめてのローカル起動（Windows / PowerShell）

画面だけをすぐ見る場合は **Node.js 22** を入れ、リポジトリのフォルダーで `npm ci`、`npm run dev` を実行し、http://localhost:3000 を開きます。DB未接続時は架空データのプレビューが表示されます。保存・ログイン・承認まで試す場合は、以下のローカルSupabaseも起動してください。

1. [Node.js 22](https://nodejs.org/) と [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) をインストールし、Docker Desktopを起動します。PowerShellで `node --version` が `v22` から始まり、`docker info` が成功することを確認します。最初のSupabase起動時はコンテナーのダウンロードがあるため、インターネット接続が必要です。
2. PowerShellでこのリポジトリのフォルダーを開き、依存パッケージを入れます。`supabase/config.toml` は用意済みなので、`supabase init` は実行しません。

   ```powershell
   npm ci
   npx --yes supabase@2.121.0 --version
   ```

   2行目で**Supabase CLI 2.121.0を取得**し、バージョンを確認します。CLIは`npx`で起動するため、全員のPCへグローバルインストールする必要はありません。DBマイグレーション用スクリプトも同じ版を使います。[CLIの公式導入手順](https://supabase.com/docs/guides/local-development/cli/getting-started)も参照できます。

3. 手元のSupabase（DB・認証）を起動します。初回は時間がかかります。起動時にこのリポジトリのマイグレーションと `supabase/seed.sql` が適用されます。

   ```powershell
   npx --yes supabase@2.121.0 start
   npx --yes supabase@2.121.0 status
   ```

4. **初回だけ** `.env.example` を `.env.local` にコピーし、`status` に表示された手元の値を記入します。ローカル起動ではクラウドのProject IDやCLIログインは不要です。

   ```powershell
   Copy-Item .env.example .env.local
   ```

   | `.env.local` の項目             | 設定する値                                       |
   | ------------------------------- | ------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `Project URL`（既定は `http://127.0.0.1:54321`） |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `Publishable` キー                               |
   | `SUPABASE_SERVICE_ROLE_KEY`     | `Secret` キー。サーバー専用                      |
   | `APP_ORIGIN`                    | `http://localhost:3000`                          |
   | `AUTO_MIGRATE`                  | `false` のまま                                   |
   | `DEV_SUPABASE_PROJECT_REF`      | 空欄のまま                                       |

   `AUTO_MIGRATE=true` と `npm run db:migrate` は**リンク済みクラウド開発DB用**です。手元のSupabaseには使用しません。キーやパスワードをREADME、Git、チャットに貼らないでください。

5. ログインや保存操作も試す場合、`.env.local` の `ALLOW_DEMO_DATA_SETUP=true`、`DEMO_SEED_AUTH_USERS=true`、`DEMO_INITIAL_PASSWORD=` に自分で決めた12文字以上の開発用パスワードを設定し、次を実行します。終了後は前者2項目を `false` に戻します。ログインには `minoriya-demo+information_systems@example.invalid` と、**自分で設定した** `DEMO_INITIAL_PASSWORD` の値を使います。下の「初期ログイン情報」のパスワードは既存の開発DB用であり、手元に新規作成したDBのパスワードではありません。

   ```powershell
   npm run db:demo
   ```

6. アプリを起動し、http://localhost:3000/login を開きます。店舗ポータルだけなら http://localhost:3000 から確認できます。終了時はアプリのターミナルで `Ctrl+C`、次に `npx --yes supabase@2.121.0 stop` を実行します。次回は `npx --yes supabase@2.121.0 start` と `npm run dev` で再開できます。

   ```powershell
   npm run dev
   ```

`supabase db reset` は手元のDBを初期化する操作なので、通常の起動には不要です。クラウドの開発用Supabaseを使う場合は、次の「ほかの開発者向け Supabase 設定」に進みます。

## 初期ログイン情報（既存の開発用DB）

- ログイン画面: http://localhost:3000/login
- メールアドレス: `minoriya-demo+information_systems@example.invalid`
- 初期パスワード: `Demo!4f415f02764eedff91f594ee05862d5e877ba9`
- 権限: 情報システム（店舗・端末管理、利用者管理、取込、監査）

このデモアカウントは同じ初期パスワードで何度でもログインできます。ほかの7ロールのメールアドレスは [.env.demo-accounts.local](./.env.demo-accounts.local) を参照してください。初期パスワードは共通です。

## ほかの開発者向け Supabase 設定

各開発者は、自分が使う **開発用 Supabase プロジェクト** を用意します。このリポジトリの共有アカウントやローカル設定ファイルをそのまま使わず、次の順で接続してください。

1. Supabase Dashboard で開発プロジェクトを作成し、**Project Settings → General → Reference ID** の20文字のIDを控えます。
2. **Connect** からProject URLを、**Settings → API Keys** から `sb_publishable_...` の公開キーと `sb_secret_...` のサーバー専用キーを取得します。公開キーはアプリに設定し、サーバー専用キーはローカルだけに保存します。
3. `.env.example` を `.env.local` にコピーし、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`DEV_SUPABASE_PROJECT_REF` を自分の開発プロジェクトの値に設定します。`AUTO_MIGRATE=true` は開発環境のみで使用します。
4. Supabase CLIへログインし、同じProject IDへリンクします。初回はDBパスワードを入力します。

   ```powershell
   npx --yes supabase@2.121.0 login
   npx --yes supabase@2.121.0 link --project-ref 自分の20文字のProjectID
   npm run db:migrate:check
   ```

5. dry-runに表示された対象を確認してから `npm run db:migrate` を実行します。以降 `npm run dev` を起動すると、`AUTO_MIGRATE=true` の設定により未適用のマイグレーションを先に適用します。
6. 架空データとログイン用の架空Authユーザーが必要な場合は、`.env.local` の `ALLOW_DEMO_DATA_SETUP=true`、`DEMO_SEED_AUTH_USERS=true` を設定し、`DEMO_INITIAL_PASSWORD` に12文字以上のローカル用初期パスワードを設定して `npm run db:demo` を実行します。`example.invalid` はメールを受信できませんが、確認済み架空アカウントとしてログインできます。
7. `npm run db:demo:devices` で架空店舗の閲覧端末を用意します。端末コードは画面に入力し、ファイル・チャットへ共有する場合も対象が架空データの開発環境であることを確認してください。

`.env.local`、`.env.demo-accounts.local`、`.env.demo-devices.local` はGitから除外されています。キーやローカルのパスワードをGitへ追加しないでください。既存プロジェクトにモックデータや運用中の利用者がある場合は、重複・既存権限への影響を確認してから投入してください。詳しくは [Supabase接続手順](./docs/supabase-local-setup.md) を参照してください。

## モック店舗端末の接続

店舗ごとの接続コードを `http://localhost:3000/station` に入力してください。この共有版では、開発環境の架空店舗 `DEMO-001` 専用コードを以下に記載しています。

| 用途                  | 接続コード                                                         |
| --------------------- | ------------------------------------------------------------------ |
| DEMO-001 店舗端末閲覧 | `6ac6881e515326727cdeb8e78e544d2e575d1f5fb1988c6b604eb357fa6bad69` |

残りの架空店舗のコードはローカルの [.env.demo-devices.local](./.env.demo-devices.local) にあります。閲覧専用コードで、担当者名や個人アカウント情報にはアクセスできません。失効した場合は管理画面で再発行してください。

| 店舗               | ファイル内の設定名      |
| ------------------ | ----------------------- |
| DEMO-001（標準）   | `DEVICE_DEMO_001_TOKEN` |
| DEMO-002（24時間） | `DEVICE_DEMO_002_TOKEN` |
| DEMO-003（モール） | `DEVICE_DEMO_003_TOKEN` |

作成・再確認は `npm run db:demo:devices`。既存コードは再実行でも維持し、管理画面で失効させた端末は再有効化しません。業務編集には別途個人ログインが必要です。

## 機能別のモックコード

以下はこの開発用DBに登録した架空コードです。売上CSVは `public/samples/sales-import.csv` にあります。

| 機能           | 参照コード・サンプル                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 店舗           | `DEMO-001`                                                                                                                             |
| 売場           | `FIXTURE-FOOD`                                                                                                                         |
| 商品           | `FIXTURE-V1-FOOD`                                                                                                                      |
| 店舗端末       | 上の `DEMO-001` 専用コード                                                                                                             |
| 売上取込       | `public/samples/sales-import.csv`（店舗 `DEMO-001`、売場 `FIXTURE-FOOD`、商品 `FIXTURE-V1-FOOD`）                                      |
| 発注           | `DEMO-001` / `FIXTURE-FOOD` / `FIXTURE-V1-FOOD`、数量 `2`                                                                              |
| 特売           | `FIXTURE-V1-FOOD`、架空の下書き `架空の週末特売`                                                                                       |
| 在庫・通常売価 | 店舗 `DEMO-001` / 商品 `FIXTURE-V1-FOOD`                                                                                               |
| 連携API        | 受信イベントID例 `fixture-v1-inventory:2026-10-21`。認証値はローカル `.env.local` の `INTEGRATION_INGEST_TOKEN` / `CRON_SECRET` を使用 |

連携APIの完全なリクエスト例は [外部連携契約](./docs/integration-api.md) を参照してください。

## 開発時の自動マイグレーション

このローカル環境では `npm run dev` の起動前に、リンク済み開発DBへ未適用のSQLマイグレーションを自動適用します。`.env.local` の `AUTO_MIGRATE=true` と `DEV_SUPABASE_PROJECT_REF` で対象を指定しています。

- 適用予定だけ確認: `npm run db:migrate:check`
- 手動で未適用分を適用: `npm run db:migrate`
- 自動適用を停止: `AUTO_MIGRATE=false`

クラウド開発DBを使う場合は、上の手順でSupabase CLIの取得・ログイン・プロジェクトのリンクを事前に完了してください。データ投入はマイグレーションとは別処理です。詳細は [マイグレーション方針](./docs/data-migrations.md) を参照してください。

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

ローカルDBの状態を確認する場合は、上の手順でDockerとSupabase CLIを起動してから実行します。

```powershell
npx --yes supabase@2.121.0 status
npx --yes supabase@2.121.0 db lint --local --fail-on error
```

テストのためにDBを作り直す場合だけ `npx --yes supabase@2.121.0 db reset` を実行します。ローカルDBの既存データが初期化されます。

手順と検証範囲は[テスト方針](./docs/testing.md)、DB変更は[マイグレーション方針](./docs/data-migrations.md)、PR・本番配備は[CI/CD](./docs/ci-cd.md)を参照してください。初期技術基盤の判断は[ADR-0001](./docs/adr/0001-platform.md)に記録しています。

## ローカルMySQLのデモ店舗端末

`.env.local` に `DATABASE_PROVIDER=mysql` とMySQL接続設定を入れた後、次のコマンドでテーブルと架空のデモ店舗データを作成できます。`DATABASE_PROVIDER=mysql` がない場合はMySQL認証ではなくローカルモック認証が選択されます。標準のローカルDB名は `minoriya_starter` です。`db:mysql:demo` は再実行可能です。

DB自体を作り直す場合は、既存データがすべて消えることを確認してから、MySQLクライアントで次のSQLを上から1文ずつ実行してください。

```sql
DROP DATABASE `minoriya_starter`;
CREATE DATABASE `minoriya_starter`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE `minoriya_starter`;
SHOW TABLES;
```

空のDBを確認した後、アプリ側では次のコマンドを順番に実行します。

```powershell
npm run db:mysql:migrate
npm run db:mysql:demo
npm run db:mysql:demo:check
npm run dev
```

`http://localhost:3000/station` で、上の店舗端末表にある `DEMO-001` 専用のモック接続コードを入力してください。端末の接続解除後に再接続する場合も同じコードを使えます。登録データは架空で、実店舗やPOSには接続しません。

初期化後は、店舗4件、商品6件、営業日別売上8件、在庫8件、特売4件、発注5件、お知らせ4件に加え、売上修正・承認・通知・店舗指示・連携ジョブ・監査ログを確認できます。未対応、処理中、対応済み、失敗、差戻し、既読・未読など、画面の条件分岐を確認できる状態を架空データで収録しています。`npm run db:mysql:demo:check` は主要な状態が揃っていることをDBから読み取って検証します。

管理画面は `minoriya-demo+information_systems@example.invalid` とREADME上部の初期パスワードでログインできます。このアカウントには `information_systems` 権限を付与します。
