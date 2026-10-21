import Link from "next/link";
import { StationForm } from "@/components/auth/station-form";
import { disconnectStation } from "@/server/actions/station";
export default function StationPage() {
  return <main className="page-shell" id="main-content"><section className="page-panel"><h1>店舗端末の接続</h1><p>情報システム部が「店舗・端末管理」で発行したコードを入力してください。接続した店舗の閲覧専用データを表示します。金額操作・発注の保存には別途個人識別が必要です。</p><StationForm /><form action={disconnectStation}><button type="submit" className="ghost-button">この端末の接続を解除</button></form><Link className="ghost-button" href="/">店舗ポータルへ戻る</Link></section></main>;
}
