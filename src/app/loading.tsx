export default function Loading() {
  return (
    <main className="page-shell loading-shell" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite">
        画面を読み込んでいます。
      </p>
      <header className="page-topbar" aria-hidden="true">
        <div className="loading-heading">
          <span className="loading-skeleton" />
          <span className="loading-skeleton" />
        </div>
      </header>
      <div className="content loading-content" aria-hidden="true">
        <div className="loading-metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="loading-surface loading-skeleton" key={index} />
          ))}
        </div>
        <div className="loading-surface loading-chart loading-skeleton" />
      </div>
    </main>
  );
}
