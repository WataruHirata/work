# 基幹システム（開発用模擬環境）

開発環境で発注連携を体験するための、架空の基幹システムです。本番の外部APIではありません。

- `order-contract.ts`: 販売管理システムから受信する発注メッセージの検証
- `order-store.ts`: 冪等キー単位で受信し、`.local/mock-core-system/orders.json` に保存
- `transport.ts`: 既存の連携ジョブから開発用基幹システムへ受け渡すアダプター

開発環境では既定で有効です。`MOCK_CORE_SYSTEM_ENABLED=false` を指定すると無効化できます。本番環境では自動的に無効になり、外部API設定を使用します。

受信結果はアプリの `/store/orders/mock-core` で確認できます。
