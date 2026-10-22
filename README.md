# みのり屋 販売管理システム（MySQL ローカル開発）

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

初回起動は下の「はじめてのローカル起動」から始められます。接続手順は[接続手順書](./docs/connected-backend.md)、API提供側の要件は[外部連携契約](./docs/integration-api.md)を参照してください。ローカルMySQLでは架空データと8ロールのログインを確認できます。

112店舗の売上取込、店舗別営業日、締め・修正承認、特売・価格変更指示、発注・通知を扱う販売管理システムです。業務要件は[統合要件書v3](./docs/requirements/みのり屋_販売管理システム_統合要件書_v3.md)の第25章と最新の明示指示を優先します。

## はじめてのローカル起動（Windows / PowerShell）

この開発環境はローカルMySQLを使います。必要なものは **Node.js 22、npm、MySQL Server 8.0以降（8.4推奨）** です。MySQL InstallerでServerを入れた場合はWindowsサービスとして起動します。PowerShellで `Get-Service *mysql*` を実行し、サービス名を確認してから必要なら管理者PowerShellで `Start-Service MySQL84` を実行してください（サービス名はインストール内容により異なります）。

リポジトリで依存関係を入れます。

```powershell
npm ci
```

初回だけ `.env.example` を `.env.local` にコピーします。既存の設定を誤って上書きしないでください。

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

`.env.local` には `DATABASE_PROVIDER=mysql`、`MYSQL_HOST=127.0.0.1`、`MYSQL_PORT=3306`、`MYSQL_DATABASE=minoriya_starter`、MySQLのユーザー名とパスワードを設定します。`SESSION_SECRET` には次のコマンドで生成した値を設定してください。

```powershell
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

生成した値はローカルだけに保存し、Gitへ追加しません。

DBとアプリ用ユーザーがまだない場合、MySQLの管理者で接続し、次を1文ずつ実行します。`<十分に強いパスワード>` は実際のパスワードへ置き換え、同じ値を `.env.local` の `MYSQL_PASSWORD` に設定してください。

```sql
CREATE DATABASE `minoriya_starter` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'minoriya_app'@'127.0.0.1' IDENTIFIED BY '<十分に強いパスワード>';
GRANT ALL PRIVILEGES ON `minoriya_starter`.* TO 'minoriya_app'@'127.0.0.1';
```

既にDBがある場合は `CREATE DATABASE` を繰り返さず、接続確認後に `.env.local` と一致するDB・ユーザーを使います。ローカル接続は次で確認できます。

```powershell
mysql --host 127.0.0.1 --port 3306 --user minoriya_app --password minoriya_starter
```

DBを作成したら、マイグレーション、架空データ、データ検証の順に実行してアプリを起動します。

```powershell
npm run db:mysql:migrate
npm run db:mysql:demo
npm run db:mysql:demo:check
npm run dev
```

ブラウザーで http://localhost:3000/login を開きます。終了時はアプリのターミナルで `Ctrl+C` を押します。MySQLサービスは次回も利用するなら停止不要です。

## 初期ログイン情報（既存の開発用DB）

- ログイン画面: http://localhost:3000/login
- メールアドレス: `minoriya-demo+information_systems@example.invalid`
- 初期パスワード: `Demo!4f415f02764eedff91f594ee05862d5e877ba9`
- 権限: 情報システム（店舗・端末管理、利用者管理、取込、監査）

このデモアカウントは同じ初期パスワードで何度でもログインできます。ほかの7ロールのメールアドレスは [.env.demo-accounts.local](./.env.demo-accounts.local) を参照してください。初期パスワードは共通です。

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

## MySQLマイグレーションの運用

MySQLのスキーマ変更は `database/mysql/migrations/` に連番SQLファイルを追加し、`npm run db:mysql:migrate` で適用します。適用済みファイルのチェックサムを記録し、内容が後から変更されていないことを検査します。適用済みSQLは編集せず、修正用の新しいマイグレーションを追加してください。マイグレーションはDB構造だけを作り、デモデータ投入は別コマンドです。

通常のアプリ起動時にマイグレーションは自動実行しません。DB変更を取り込んだ後に明示的にマイグレーションを実行し、続けて必要なデータ更新と画面確認を行ってください。ローカルDBを作り直すSQLは全データを消すため、通常の起動では使用しません。

### 他の開発者がDB変更を取り込む手順

クローン直後、または `git pull` で `database/mysql/migrations/` に新しいSQLファイルを取得した場合は、対象のMySQLサービスを起動し、`.env.local` の `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD` が自分のローカルDBを指すことを確認してから、リポジトリ直下で次を実行します。

```powershell
npm ci
npm run db:mysql:migrate
```

`npm ci` は `package-lock.json` が更新されている場合に必要です。`db:mysql:migrate` は `schema_migrations` を確認し、未適用のSQLファイルだけをファイル名順に適用します。すでに適用済みのSQLは再実行せず、内容が変更されていれば停止します。停止した場合は、適用済みSQLを編集せず、変更元から追加された新しいマイグレーションを確認してください。

デモデータが必要な場合だけ、マイグレーションの後に次を実行します。既存のローカルデータを利用する場合は実行しません。

```powershell
npm run db:mysql:demo
npm run db:mysql:demo:check
```

## 構成

機能やフォルダーの役割を初めて確認する方は、[非技術者向けの機能・フォルダー案内](./docs/plain-language-guide.md)をご覧ください。店舗・本部で使う機能、申請や通知の流れ、現在試せる範囲を、専門用語を抑えて説明しています。

**Next.js / TypeScript / Node.js 22** で画面とバックエンドを実装し、UIコンポーネントには **Material UI（MUI）**、ローカル開発DB・認証には **MySQL 8.4** を使用します。一つのアプリの中で役割を分離した構成です。Pythonは要件書の検査にのみ使用します。

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
├── infrastructure/        # DB・HTTPの具体的な接続
├── config/                # 画面・テーマ設定
└── mocks/                 # 架空データ・操作プレビュー
database/mysql/            # MySQLスキーマ・接続実装
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

MySQL接続とサンプルデータの状態を確認する場合は、次を実行します。

```powershell
npm run db:mysql:demo:check
```

手順と検証範囲は[テスト方針](./docs/testing.md)、DB変更は[マイグレーション方針](./docs/data-migrations.md)、PR・配備は[CI/CD](./docs/ci-cd.md)を参照してください。

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

初期化後は、基礎データに加えて表示確認用の拡張データとして、60店舗、120商品、1,800件以上の営業日別売上、10,800件以上の売上明細、480件以上の在庫を作成します。店舗状態・営業時間・商品名の長さ・カテゴリ・税率・特売対象状態・売上状態・返品/取消・在庫量を分散させ、一覧、ページ送り、集計、グラフ、折返し表示を目視確認できます。すべて架空データです。`npm run db:mysql:demo:check` は件数と主要な表示パターンが揃っていることをDBから読み取って検証します。

管理画面は `minoriya-demo+information_systems@example.invalid` とREADME上部の初期パスワードでログインできます。このアカウントには `information_systems` 権限を付与します。
