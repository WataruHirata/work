export function campaignChangeRequest({
  campaignName,
  productName,
  productCode,
  priceYen,
  startsAt,
  endsAt,
}: {
  campaignName: string;
  productName: string;
  productCode: string;
  priceYen: number;
  startsAt: Date;
  endsAt: Date;
}) {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  return {
    title: `POS・値札変更依頼：${campaignName} / ${productName}`.slice(0, 200),
    message: `特売「${campaignName.slice(0, 200)}」のPOS価格設定と値札の変更をお願いします。\n商品：${productCode.slice(0, 100)} / ${productName.slice(0, 200)}\n特売価格：${priceYen.toLocaleString("ja-JP")}円\n開始：${format(startsAt)}（日本時間）\n終了：${format(endsAt)}（日本時間）\n開始に合わせてPOSの特売価格設定・値札・POP・売場表示を確認してください。終了時は通常売価を確認してPOS設定と値札を戻してください。\nこの通知は変更依頼です。POSに反映済みであることを示しません。`,
  };
}
