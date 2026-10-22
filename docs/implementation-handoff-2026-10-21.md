# 実装引継ぎメモ（2026-10-21）

このファイルは、新しい `work` フォルダを開いたあと、チャットにそのまま貼って使うための引き継ぎメモです。

前提:
- このプロジェクトは Next.js + TypeScript + Supabase の販売管理システムです。
- ここまでで、起動基盤・DBスキーマ・営業データ・特売通知・修正依頼/承認の骨組みが整っています。
- 今の状態では、起動とビルドは通り、データベースの主要テストも通っています。

## 1. ここまでの進捗サマリ

完了済み:
- Next.js の起動問題を修正
- App Router のサーバー/クライアント境界を整理
- 売上集計 API と CSV 出力の土台を追加
- 売上修正依頼フォームと承認フォームを実装
- 通知から承認導線へ直接遷移するよう改善
- DB のタイムイベント通知（開始前/開始/終了）を追加
- スキーマ関連テストが通過

未完了/継続課題:
- 実運用用の cron / scheduler の定期実行設定
- 本番向けの権限・監査・CSV 最終整備
- 既存POS連携や本番SLAまわりの最終確認

## 2. 重要な修正ファイル

### 2-1. 特売開始前/開始/終了の自動通知を追加

ファイル:
- `supabase/migrations/202610210011_campaign_time_notifications.sql`
- `src/server/integrations/run.ts`

この修正で、定期実行時に次を自動判定します。
- 開始 30 分前: `pre_start`
- 開始時刻到達: `started`
- 終了時刻到達: `ended`

重複通知を避けるため、`campaign_alert_events` を使ってイベント発火を 1 回に制限しています。

修正コード:

```sql
create table public.campaign_alert_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('pre_start', 'started', 'ended')),
  created_at timestamptz not null default now(),
  primary key (campaign_id, event_type)
);

create or replace function public.emit_campaign_timing_alert(
  p_campaign_id uuid,
  p_event_type text,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_campaign_id is null or p_event_type is null or p_title is null or p_message is null then
    raise exception 'Campaign timing alert details are required';
  end if;
  if p_event_type not in ('pre_start', 'started', 'ended') then
    raise exception 'Unsupported campaign timing event';
  end if;

  insert into public.campaign_alert_events(campaign_id, event_type)
  values (p_campaign_id, p_event_type)
  on conflict (campaign_id, event_type) do nothing;
  if not found then
    return;
  end if;

  insert into public.store_announcements(store_id, title, message, created_by)
  select target.store_id, p_title, p_message, (select auth.uid())
  from public.campaign_store_targets target
  where target.campaign_id = p_campaign_id;

  insert into public.notifications(user_id, notification_type, title, message)
  select distinct assignment.user_id, 'campaign_' || p_event_type, p_title, p_message
  from public.user_role_assignments assignment
  where assignment.role in ('product_office', 'store_manager', 'department_lead', 'staff')
    and (
      assignment.role = 'product_office'
      or assignment.store_id in (
        select store_id from public.campaign_store_targets where campaign_id = p_campaign_id
      )
    );
end;
$$;
```

```sql
create or replace function public.refresh_campaign_timing_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign record;
begin
  for v_campaign in
    select c.id, c.name, c.starts_at
    from public.campaigns c
    where c.status = 'scheduled'
      and c.published_at is not null
      and now() >= c.starts_at - interval '30 minutes'
      and now() < c.starts_at
  loop
    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'pre_start',
      '特売開始予定: ' || left(v_campaign.name, 180),
      '開始予定時刻まで30分を切りました。対象店舗では値札・POP・売場表示の確認と完了登録をお願いします。'
    );
  end loop;

  for v_campaign in
    select c.id, c.name, c.starts_at, c.ends_at
    from public.campaigns c
    where c.status = 'scheduled'
      and c.published_at is not null
      and now() >= c.starts_at
      and now() < c.ends_at
  loop
    update public.campaigns
    set status = 'active', updated_at = now()
    where id = v_campaign.id and status = 'scheduled';

    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'started',
      '特売開始: ' || left(v_campaign.name, 180),
      '特売が開始されました。店舗では作業状況を確認し、未完了の項目を登録してください。'
    );
  end loop;

  for v_campaign in
    select c.id, c.name, c.ends_at
    from public.campaigns c
    where c.status in ('scheduled', 'active')
      and now() >= c.ends_at
  loop
    update public.campaigns
    set status = 'completed', updated_at = now()
    where id = v_campaign.id and status in ('scheduled', 'active');

    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'ended',
      '特売終了: ' || left(v_campaign.name, 180),
      '特売期間が終了しました。通常価格復帰と最終確認を行ってください。'
    );
  end loop;
end;
$$;
```

```ts
// src/server/integrations/run.ts
import "server-only";
import { createSupabaseServerClient } from "@/infrastructure/supabase/clients/server";
import { integrationRuntime, integrationStore } from "@/server/container";
import { runIntegrationBatch } from "@/server/integrations/worker";

export async function runConfiguredIntegrations() {
  const client = await createSupabaseServerClient();
  await client.rpc("refresh_campaign_timing_alerts");
  const { transport, kinds } = integrationRuntime();
  return runIntegrationBatch(integrationStore(), transport, kinds);
}
```

これにより、`/api/integrations/run` 実行時に通知判定が走るようになります。

## 3. 既存ロジックの重要な修正とコード

### 3-1. 売上修正依頼と承認のフォーム統合

ファイル:
- `src/components/workspaces/workspace-forms.tsx`
- `src/server/actions/workspace.ts`

目的:
- 店舗側で修正依頼
- 管理側で承認/却下
- その後に通知と導線が続く

重要な修正ポイント:
- `requestCorrection` のバリデーションを明確化
- `approveCorrection` の承認コメントと拒否時の条件を整理
- 通知がそのまま承認画面へ遷移できるよう `notification-inbox` 連携

```ts
// src/server/actions/workspace.ts
export async function requestCorrectionAction(_previous: WorkspaceActionState, data: FormData): Promise<WorkspaceActionState> {
  try {
    await activeSession();
    const salesDayId = uuid(data.get("salesDayId"));
    const reason = text(data.get("reason"), 500);
    const beforeAmount = integer(data.get("beforeAmount"));
    const afterAmount = integer(data.get("afterAmount"));
    const confirm = data.get("confirm") === "true";

    if (!confirm) throw new Error("修正内容と理由の確認が必要です。");
    if (beforeAmount < 0 || afterAmount < 0) throw new Error("金額は0以上で入力してください。");

    await repository().execute("requestCorrection", {
      p_sales_day_id: salesDayId,
      p_reason: reason,
      p_before_amount_yen: beforeAmount,
      p_after_amount_yen: afterAmount,
    });

    revalidatePath("/store");
    revalidatePath("/admin");
    return { success: "修正依頼を受け付けました。" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
```

```ts
// src/components/notifications/notification-inbox.tsx
{!row.read_at && <OperationForm operation="markRead" label="既読にする"><input type="hidden" name="notificationId" value={row.id} /></OperationForm>}
```

## 4. 画面とUIの引き継ぎポイント

主要な UI 画面:
- `src/app/store/*`
- `src/app/admin/*`
- `src/components/workspaces/data-workspace.tsx`
- `src/components/campaigns/campaign-workspace.tsx`
- `src/components/notifications/notification-inbox.tsx`

ポイント:
- 画面は role / store / campaign の切り分けを前提に構成
- 画面自体だけでなく、server action と repository をセットで扱う設計
- 画面から `repo.execute(...)` に接続し、DB へ業務処理を委譲する構成

## 5. ビルドと検証結果

実施した検証:
- `npm test -- --run tests/database-schema.test.ts`

結果:
- 11 tests passed
- 主要な migration と campaign / correction / instruction の RLS・処理が正常に動作

また、プロジェクト全体のビルドは通る状態を確認済みです。

## 6. 次にやるべきこと（本番に近づけるには）

優先度順:
1. 定期実行（cron）を本番環境に接続
2. `CRON_SECRET` と `APP_ORIGIN` の本番設定確認
3. 通知文言と UI の整理
4. CSV / 監査 / 権限チェックの最終整備
5. 本番 DB へ新 migration を適用する手順を文書化

## 7. そのまま貼れる引き継ぎ文

以下をそのまま新しいチャットに貼ると、現状の実装と更新内容を伝えられます。

> ここまでの実装を引き継ぎます。対象プロジェクトは Next.js + TypeScript + Supabase の販売管理システムです。以下を反映済みです。
>
> - 起動問題を修正済み（App Router の client/server 境界整理）
> - 売上集計 API と CSV 出力の土台を追加済み
> - 売上修正依頼フォームと承認フォームを実装済み
> - 通知→承認画面への導線を追加済み
> - 特売開始前・開始時・終了時の自動通知を追加済み
> - `refresh_campaign_timing_alerts()` を定期実行経路に接続済み
> - DB テストは通過済み（11 tests passed）
>
> 主要ファイル:
> - `supabase/migrations/202610210011_campaign_time_notifications.sql`
> - `src/server/integrations/run.ts`
> - `src/server/actions/workspace.ts`
> - `src/components/workspaces/workspace-forms.tsx`
> - `src/components/notifications/notification-inbox.tsx`
>
> 重要コード:
> ```ts
> export async function runConfiguredIntegrations() {
>   const client = await createSupabaseServerClient();
>   await client.rpc("refresh_campaign_timing_alerts");
>   const { transport, kinds } = integrationRuntime();
>   return runIntegrationBatch(integrationStore(), transport, kinds);
> }
> ```
>
> ```sql
> create or replace function public.refresh_campaign_timing_alerts()
> returns void
> language plpgsql
> security definer
> set search_path = ''
> as $$
>   -- start 30 min before / start / end detection
> $$;
> ```
>
> これで、定期実行時に特売の開始前/開始/終了通知が発火します。次は cron/スケジューラ接続と本番設定を整えれば実運用段階です。

## 8. 最終メモ

このプロジェクトは、過去の不完全版を引き継いで構築を進めており、今の実装は「業務骨格が実際に動く状態」まで到達しています。次の実運用フェーズは、外部スケジューラと本番環境設定を繋ぐことです。
