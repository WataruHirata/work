export function FeatureNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="page-panel">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
