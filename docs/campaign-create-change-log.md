# 特売新規作成画面の実装記録

## 1. 現在の結論

はい、今のリポジトリには「管理者共通メニューから、特売の店舗・期間・商品・価格を指定して新規作成する画面」がすでにあります。

- 管理メニューの表示設定: `src/config/ui.ts`
- 管理画面の入口: `src/app/admin/campaigns/page.tsx`
- 画面本体: `src/components/campaigns/campaign-workspace.tsx`
- 新規作成フォーム: `src/components/campaigns/campaign-management.tsx`
- 保存処理: `src/server/actions/campaigns.ts`

現在の画面では、以下を入力して特売を下書き保存できます。

- 特売名
- 開始日時
- 終了日時
- 対象商品一覧
- 特売価格（円）
- 対象店舗の選択

## 2. 実際の画面の入口

1. 管理者ログイン
2. `http://localhost:3000/login` にアクセス
3. `minoriya-demo+information_systems@example.invalid` でログイン
4. 管理者メニューから「特売管理」を開く
5. `http://localhost:3000/admin/campaigns` を表示

管理メニュー定義は `src/config/ui.ts` にあります。

```ts
campaigns: {
  href: "/admin/campaigns",
  label: "特売管理",
  title: "特売一覧・特売登録",
  icon: "campaigns",
}
```

## 3. 実装の最小置換パターン

もし最初からこの機能を作るなら、最小構成は次のファイル群です。

### 3-1. メニュー追加

- `src/config/ui.ts`
- 役割: 「管理用共通メニュー」に「特売管理」を追加

### 3-2. URLとページ入口

- `src/app/admin/campaigns/page.tsx`
- 役割: `requireAdminFeature("campaigns")` を通して権限確認し、`CampaignWorkspace` を表示

### 3-3. 画面本体

- `src/components/campaigns/campaign-workspace.tsx`
- 役割: 店舗・商品・特売・対象店舗を読み込み、管理用 UI を構成

### 3-4. 新規作成フォーム

- `src/components/campaigns/campaign-management.tsx`
- 役割: 特売名、開始/終了日時、商品・価格、店舗選択を入力するフォームの実装

### 3-5. 保存処理

- `src/server/actions/campaigns.ts`
- 役割: `createCampaignDraftAction` で保存処理を実行

## 4. 実装の核となる処理

### 4-1. フォームの入力項目

`CampaignDraftForm` は次を持ちます。

- `name`
- `startsAt`
- `endsAt`
- `items`（商品ID + 特売価格）
- `storeIds`

`CampaignDraftForm` の中核は次の形です。

```tsx
<input name="name" placeholder="例：秋の青果フェア" required />
<input name="startsAt" type="datetime-local" required />
<input name="endsAt" type="datetime-local" required />
<input type="hidden" name="items" value={JSON.stringify(...)} />
```

### 4-2. 保存処理

`createCampaignDraftAction` では入力値を検証し、`repository().execute("createCampaign", ...)` へ渡します。

```ts
await repository().execute("createCampaign", {
  p_name: text(data.get("name"), 200),
  p_starts_at: starts,
  p_ends_at: ends,
  p_items: items,
  p_store_ids: stores,
});
```

ここで、以下をチェックしています。

- 商品を1件以上入力されたか
- 同じ商品を重複登録していないか
- 対象店舗が1件以上か
- 開始日時 < 終了日時か

## 5. 何を実行すれば動くか

### 5-1. 最小起動

```powershell
cd "C:\Users\Administrator\Downloads\work (3)\work"
npm ci
npm run dev
```

### 5-2. 管理ログイン

```powershell
http://localhost:3000/login
```

メールアドレス:

```text
minoriya-demo+information_systems@example.invalid
```

初期パスワード:

```text
Demo!4f415f02764eedff91f594ee05862d5e877ba9
```

### 5-3. 対象画面

```text
http://localhost:3000/admin/campaigns
```

## 6. 変更ログ（このファイルの記録）

### 2026-10-22

- 状態: 対象機能あり
- 内容: 管理者共通メニューからの特売新規作成・店舗/期間/価格指定が実装済み
- 確認した主ファイル:
  - `src/config/ui.ts`
  - `src/app/admin/campaigns/page.tsx`
  - `src/components/campaigns/campaign-workspace.tsx`
  - `src/components/campaigns/campaign-management.tsx`
  - `src/server/actions/campaigns.ts`
- 実行確認:
  - `npm ci` 実行済み
  - `npm run dev` を起動すれば画面確認可能
- 重要メモ:
  - これは「新規作成フォーム」そのものが既に存在する状態
  - もし「専用ページに分離したい」場合は、同じ構成をベースに画面のラッパーを追加する

## 7. 変更を残す運用ルール

- 実装ごとにこのファイルを追記する
- どのファイルを置き換えたかを明示する
- 画面URLと実行コマンドを残す
- 変更理由と対象要件を1箇所にまとめる
- 新しい画面追加時は「初期状態 → 変更 → 確認手順」の順で記録する

## 8. まとめ

今回の現状では、管理者メニューからの特売新規作成はすでに実装済みです。
「店舗・期間・価格を指定して特売を作る」の基本機能はあるので、次に必要なのは、

- 専用の新規作成ページに分離するか
- フォームの項目を 더増やすか
- 公開前に承認フローを追加するか

のどれかに絞って、最小ファイルで差分を作る形が自然です。
