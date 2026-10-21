# Supabase の接続設定

## 設定済み

`.env.local` に、提供された Project ID から組み立てた Project URL と publishable key を設定した。URL は `https://iocbljrapxlobvdcwqfx.supabase.co`。Dashboard の Connect に表示される Project URL と一致することを確認する。実際の接続・キーの有効性は未確認。

コードとの互換性のため公開キーの変数名は `NEXT_PUBLIC_SUPABASE_ANON_KEY` のまま。publishable key は公開可能なキーであり、管理者権限の秘密キーではない。`.env.local` は既存の `.gitignore` により Git の対象外。

## 1. サーバー専用キーを追加

1. Supabase Dashboard で対象プロジェクトを開く。
2. **Settings → API Keys → Publishable and secret API keys** を開く。
3. **Secret key** を表示・コピーする。存在しない場合は作成する。
4. `.env.local` の `SUPABASE_SERVICE_ROLE_KEY=` の右側に貼り付けて保存する。現在の SDK は新しい `sb_secret_...` 形式にも対応する。従来の **Legacy anon, service_role API keys** の `service_role` も使用できる。

この値は利用者作成・デモ投入・連携ジョブなどのサーバー処理で使用する。公開キーだけでも通常の Auth 呼び出しは可能だが、業務操作には下記のスキーマ・利用者・権限登録が必要。

## 2. DB マイグレーションの準備

API キーだけではマイグレーションを適用できない。CLI での Supabase アカウント認証と、必要に応じて DB パスワードを使用する。

- **DB パスワード**：プロジェクト作成時のもの。分からなければ **Database → Settings** の **Database password / Reset database password** から再設定する。再設定すると既存の接続元にも更新が必要。
- **CLI の認証**：`npx supabase login` でブラウザ認証する。トークン入力が必要な場合はアカウント設定の **Access Tokens** で作成する。アプリの `.env.local` にアクセストークンを保存する必要はない。

PowerShell でプロジェクトディレクトリから実行する。初回は npx による CLI のダウンロードが発生する。

```powershell
cd C:\演習\work
npx supabase login
npx supabase link --project-ref iocbljrapxlobvdcwqfx
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

すでにモックデータが入っているため、既存テーブルと `supabase/migrations` の定義を比較してから適用する。dry-run は適用予定の確認であり、既存スキーマとの互換性を保証しない。差異がある場合は既存データを保持する互換マイグレーションを用意する。DB の reset は実行しない。

差分確認が済んだ場合の適用コマンド：

```powershell
npx supabase db push --linked
```

## 3. Auth の設定とログイン用データ

1. **Authentication → URL Configuration** を開く。
2. **Site URL** を `http://localhost:3000` に設定する。
3. **Redirect URLs** に `http://localhost:3000/auth/callback` を追加する。
4. **Authentication → Users** でログイン用ユーザーが存在することを確認する。業務テーブルのモックデータだけではログインできない。
5. Auth ユーザーの UUID に一致する `app_users.id` と、有効な `user_role_assignments` が必要。既存データとの照合は [接続手順](./connected-backend.md) を参照。

新しい架空ユーザーが必要な場合だけ、同手順書の `npm run db:demo` を利用する。既存モックデータの利用に必須ではない。パスワード再設定メールも確認する場合はメール送信設定が必要。

## 4. 起動

設定後、開発サーバーを再起動して `http://localhost:3000/login` を開く。

```powershell
npm run dev
```

ERP/POS の URL・トークン、`CRON_SECRET`、`INTEGRATION_INGEST_TOKEN` は外部連携を有効にする段階で設定する。Supabase の通常ログインのために取得する情報ではない。

参考：[API キー](https://supabase.com/docs/guides/getting-started/api-keys)、[CLI 運用](https://supabase.com/docs/guides/local-development/cli-workflows)、[Auth のリダイレクト設定](https://supabase.com/docs/guides/auth/redirect-urls)。
