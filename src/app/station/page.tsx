import Link from "next/link";
import { StationForm } from "@/components/auth/station-form";
export default function StationPage() {
  const autoConnect = process.env.DEMO_STATION_AUTO_CONNECT === "true";
  return (
    <main className="page-shell" id="main-content">
      <section className="page-panel">
        <h1>店舗端末の接続</h1>
        <p>
          {autoConnect
            ? "デバイス1としてデモ店舗1へ接続します。店舗の情報表示と発注を、管理機能へのログインなしで利用できます。"
            : "情報システム部が「店舗・端末管理」で発行したコードを入力してください。接続した店舗の情報表示と発注を、管理機能へのログインなしで利用できます。"}
        </p>
        <StationForm autoConnect={autoConnect} />
        <Link className="ghost-button" href="/">
          店舗ポータルへ戻る
        </Link>
      </section>
    </main>
  );
}
