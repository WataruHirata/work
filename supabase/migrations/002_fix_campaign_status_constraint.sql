-- campaigns.status のCHECK制約を現在のデータ契約に合わせる。
-- 許可する状態:
-- draft      : 下書き
-- scheduled  : 公開・開始待ち
-- active     : 実施中
-- completed  : 終了済み

-- 既存データに新しい制約の対象外となる値がないことを確認する。
-- 不正な値が存在する場合は、後続のADD CONSTRAINTが失敗する。
SELECT
  id,
  name,
  status
FROM campaigns
WHERE status NOT IN (
  'draft',
  'scheduled',
  'active',
  'completed'
);

-- 旧制約が存在する場合だけ削除する。
SET @campaign_status_constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'campaigns'
    AND CONSTRAINT_NAME = 'campaign_status_valid'
    AND CONSTRAINT_TYPE = 'CHECK'
);

SET @drop_campaign_status_constraint_sql = IF(
  @campaign_status_constraint_exists > 0,
  'ALTER TABLE campaigns DROP CHECK campaign_status_valid',
  'SELECT 1'
);

PREPARE drop_campaign_status_constraint_statement
FROM @drop_campaign_status_constraint_sql;

EXECUTE drop_campaign_status_constraint_statement;

DEALLOCATE PREPARE drop_campaign_status_constraint_statement;

-- 現在のデータ契約に合わせてCHECK制約を作り直す。
ALTER TABLE campaigns
  ADD CONSTRAINT campaign_status_valid
  CHECK (
    status IN (
      'draft',
      'scheduled',
      'active',
      'completed'
    )
  );
  