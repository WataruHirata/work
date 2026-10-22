# 外部連携APIの接続契約 v1

本書はアプリ側で受け渡す標準形式であり、既存POS/基幹ベンダーの物理IFを確定したものではない。ベンダーの固定長/CSV/API仕様との変換は接続側アダプターで実装する。認証情報は環境変数で注入し、本文/URL/ログへ含めない。

## 送信（アプリ → 接続側アダプター）

送信先は `ERP_ORDER_API_URL` または `POS_PRICE_API_URL`。POST、JSON、Bearer認証、`Idempotency-Key` ヘッダーを使用する。ProductionではHTTPSのみとし、リダイレクトやURL内認証情報/クエリーを許可しない。

```json
{
  "version": 1,
  "kind": "order",
  "idempotencyKey": "order:要求識別子",
  "payload": {
    "orderId": "アプリ内発注ID",
    "storeId": "アプリ内店舗ID",
    "storeCode": "DEMO-001",
    "departmentId": "アプリ内売場ID",
    "departmentCode": "FIXTURE-FOOD",
    "deliveryDate": "2026-11-01",
    "items": [{ "productId": "アプリ内商品ID", "productCode": "FIXTURE-V1-FOOD", "quantity": 2 }]
  }
}
```

特売適用は `kind=campaign_price`。payloadには `campaignId,itemId,productId,productCode,storeId,storeCode,priceYen,startsAt,endsAt` を含む。通常売価復帰は `kind=campaign_restore` で、これらのID/コード、`priceYen,endsAt,normalPriceRevision` を含む（startsAtは不要）。時刻はタイムゾーン付きISO形式。操作者の内部IDは外部へ送らない。

### 接続側に必須の保証

1. 同一識別子/同一内容を複数回受信しても、一度しか業務へ適用しない。結果は永続化し、再送へ同じ結果を返す。矛盾する同一識別子は409等で拒否する。
2. 発注のokは基幹が受け付けたことを示す。納品完了や発注承認完了を意味しない。
3. POS価格のokは、対象店舗・商品で実際に価格反映を確認できた結果にする。単に送信キューへ入れただけではokにしない。
4. 特売適用は処理時点でも期間を確認し、終了済みの要求を後から適用しない。
5. 通常売価復帰は `normalPriceRevision` の前提を正本と照合する。同一店舗/商品へ新しい通常売価を適用済みなら、それより古い版を後から適用しない。正本の価格と要求が違う場合は成功扱いせず409等で拒否する。
6. HTTPタイムアウト後も同じ要求が処理済みの可能性がある。同じ版は同じ識別子、新版の通常売価は版を含む別の識別子になる。接続側の版比較により遅れて到着する旧要求を拒否する。

成功応答（発注）:

```json
{ "ok": true, "idempotencyKey": "受信した識別子", "reference": "基幹の受付番号" }
```

価格応答は `appliedPriceYen` を追加し、通常売価復帰では `normalPriceRevision` も返す。アプリは要求識別子・実反映価格・通常売価版を照合し、相違を失敗にする。`reference` は空でない200文字以内の処理番号。失敗応答の本文をログ/監査へ転載せず、HTTP状態等の制御された情報を記録する。

## 受信（接続側 → アプリ）

`POST /api/integrations/ingest`、Bearerに `INTEGRATION_INGEST_TOKEN` を指定する。

```json
{ "version": 1, "eventId": "送信元:一意なイベントID", "kind": "inventory", "rows": [] }
```

1要求5MB以内、1～10,000行。大きな日次データの分割・全ファイル受信完了の判定は、正式なPOSファイル/マニフェスト仕様に合わせて接続側と設計する。現行の取込は1標準要求単位の原子的処理であり、140万明細/日の実測・全ファイル完了を証明するものではない。

同一eventId/同一内容は再適用しない。同一eventIdの異なる内容は拒否する。再送時にeventIdを変更しない。行に不正がある場合は、その要求全体をロールバックする。通信が切れた場合はDBコミット済みの可能性を考慮して同じ内容/IDを再送する。

| kind      | 各行の必須項目・意味                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inventory | `store_id,department_id,product_id,quantity,observed_at,source_reference`。IDはアプリのUUID。古いobserved_atは最新在庫を上書きしない。未来時刻を拒否                                                                                                                                  |
| prices    | `product_id,store_id,price_yen,valid_from,valid_until,promotion_eligibility`。通常売価正本の参照値。区分はeligible/excluded/not_configured。valid_untilはnull可。store_idがnullの全店値と店舗値が競合する場合、優先順位を推測せず復帰を停止                                           |
| sales     | `store_code,product_code,department_code,business_date,transaction_time,source_row_key,receipt_key,customer_count,quantity,amount_yen,tax_rate,line_type`。金額はPOS確定済みの税込円整数、税率8/10、種別sale/discount/void/return。営業日は店舗境界と照合。取引日時はタイムゾーン必須 |

商品/店舗/売場は先にマスタへ存在する必要がある。社員・顧客情報、カード番号、ベンダートークンを連携行へ含めない。通常売価の正本・EDLP分類・価格優先順位はQ-17等の決定を踏まえ、接続側で解決する。

標準売上CSVも同じsales列を利用する。`/samples/sales-import.csv` に架空の例がある。商品税率に対してイートイン等の取引税区分が異なる場合があるため、取引ごとの税区分を保持する。既存POSの取消・返品の業務判定を、このCSV機能で勝手に置き換えない。

## 定期実行・結果・再処理

`POST /api/integrations/run`（GETも可）。Bearerに `CRON_SECRET` を指定する。アプリは設定済みの連携種別だけを取得し、同時に最大4件を処理する。外部HTTPのタイムアウトは15秒、DBの処理リースは2分の実装既定値であり、業務SLAではない。

通常売価は実行時に参照し、版付き要求へ変換する。DB結果確定はリースIDと有効期限で検査する。外部成功後のDB通信断では、勝手に別の失敗確定をせず、同じ外部識別子での再照合が可能な状態を残す。

失敗は `integration_jobs`、発注/店舗商品別状態、店舗と本部への通知へ反映する。権限保有者は画面から再処理を予約できる。無期限の自動再試行・未確定の保存期間/監視時間は追加しない。期限切れリースは次回の実行で再取得する。

## この作業で未実施の確認

実ベンダーへの疎通、実POSでの価格反映、同時稼働中のベンダー側の版比較、メール到達、Supabase実環境の認証E2E、日次全店性能、リストア試験は未実施。接続側が上記契約を満たすことをステージングで検証してから本番へ展開する。
