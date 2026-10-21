"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell" id="main-content">
      <section className="page-panel">
        <h1>画面を読み込めませんでした</h1>
        <p role="alert">
          DB接続または認証サービスの状態を確認し、再度お試しください。
        </p>
        <button className="primary-button" onClick={reset}>
          再試行
        </button>
      </section>
    </main>
  );
}
