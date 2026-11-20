export function PageHead({ top, title, lao, sub }: { top: React.ReactNode; title: string; lao?: string | null; sub?: string }) {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          {top}
          <h1>{title}</h1>
          {lao && <div className="lo" lang="lo">{lao}</div>}
          {sub && <p>{sub}</p>}
        </div>
      </section>
      <div className="lao-band" />
    </>
  );
}
