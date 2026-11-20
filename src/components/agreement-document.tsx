import type { Agreement } from "@/modules/agreements/queries";
import { agreementRef } from "@/modules/agreements/queries";
import { durationMonths, longDate } from "@/modules/agreements/content";
import { ARTICLE_TITLES, DOCUMENT_TITLE, fill, PARTS, PROVIDER, SIGNATURE_INTRO, type Article, type Clause } from "@/modules/agreements/template";
import { formatMoney, totalsByBilling } from "@/modules/proposals/money";

const BILLING_LABEL: Record<string, Clause> = {
  fixed: { lo: "ຄົງທີ່", en: "Fixed" }, monthly: { lo: "ລາຍເດືອນ", en: "Monthly" }, yearly: { lo: "ລາຍປີ", en: "Yearly" },
};

// One clause in both languages: Lao first (it prevails, Article 15), then English.
type Fields = { en: Record<string, string>; lo: Record<string, string> };

function Bi({ c, fields, as: Tag = "p" }: { c: Clause; fields: Fields; as?: "p" | "li" }) {
  return (
    <Tag className="bi">
      {c.lo && <span lang="lo" className="bi-lo">{fill(c.lo, fields.lo)}</span>}
      <span lang="en" className="bi-en">{fill(c.en, fields.en)}</span>
    </Tag>
  );
}

function ArticleBlock({ a, fields }: { a: Article; fields: Fields }) {
  return (
    <section className="ag-article">
      <h3><span lang="lo">ມາດຕາ {a.no} — {a.title.lo}</span><br />Article {a.no} — {a.title.en}</h3>
      {a.intro && <Bi c={a.intro} fields={fields} />}
      {a.items && <ol className="ag-list">{a.items.map((c, i) => <Bi key={i} c={c} fields={fields} as="li" />)}</ol>}
      {a.paragraphs?.map((c, i) => <Bi key={i} c={c} fields={fields} />)}
    </section>
  );
}

// The agreement exactly as it is printed and signed. Shared by staff and client views.
export function AgreementDocument({ a }: { a: Agreement }) {
  const c = a.content;
  // Field values per language (dates are written differently in Lao and English).
  const fields: Fields = {
    en: { start: longDate(a.start_date, "en"), end: longDate(a.end_date, "en"), proposal: c.proposal_ref },
    lo: { start: longDate(a.start_date, "lo"), end: longDate(a.end_date, "lo"), proposal: c.proposal_ref },
  };
  const totals = totalsByBilling(c.items);
  const months = durationMonths(a.start_date, a.end_date);
  const date = (a.issued_at ?? a.created_at).slice(0, 10);
  const byNo = new Map(c.articles.map((x) => [x.no, x]));

  const generated: Record<number, React.ReactNode> = {
    1: (
      <section className="ag-article" key={1}>
        <h3><span lang="lo">ມາດຕາ 1 — {ARTICLE_TITLES[1].lo}</span><br />Article 1 — {ARTICLE_TITLES[1].en}</h3>
        <p className="bi"><span lang="lo" className="bi-lo">ຜູ້ໃຫ້ບໍລິການ: {PROVIDER.name.lo}, {PROVIDER.address.lo}</span><span className="bi-en">Service Provider: {PROVIDER.name.en}</span></p>
        <p className="bi"><span lang="lo" className="bi-lo">ລູກຄ້າ: {c.client_name}</span><span className="bi-en">Client: {c.client_name}</span></p>
      </section>
    ),
    2: <ArticleBlock key={2} a={c.definitions} fields={fields} />,
    3: (
      <section className="ag-article" key={3}>
        <h3><span lang="lo">ມາດຕາ 3 — {ARTICLE_TITLES[3].lo}</span><br />Article 3 — {ARTICLE_TITLES[3].en}</h3>
        <Bi c={c.scope_intro} fields={fields} />
        <table className="doc-table">
          <thead><tr><th><span lang="lo">ບໍລິການ</span> / Service</th><th><span lang="lo">ຜົນງານ</span> / Deliverables</th><th><span lang="lo">ປະເພດ</span> / Type</th><th className="num"><span lang="lo">ຄ່າທຳນຽມ</span> / Fee</th></tr></thead>
          <tbody>
            {c.items.map((it, i) => (
              <tr key={i}>
                <td>{it.title_lo && <div lang="lo">{it.title_lo}</div>}<b>{it.title}</b></td>
                <td><div className="doc-cell">{it.deliverables || "—"}</div></td>
                <td><span lang="lo">{BILLING_LABEL[it.billing].lo}</span> / {BILLING_LABEL[it.billing].en}</td>
                <td className="num">{formatMoney(it.amount, c.currency, it.billing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ),
    4: (
      <section className="ag-article" key={4}>
        <h3><span lang="lo">ມາດຕາ 4 — {ARTICLE_TITLES[4].lo}</span><br />Article 4 — {ARTICLE_TITLES[4].en}</h3>
        <table className="doc-table">
          <tbody>
            {totals.map((t) => (
              <tr key={t.billing}>
                <td><span lang="lo">ຄ່າທຳນຽມລວມ ({BILLING_LABEL[t.billing].lo})</span> / Total fees ({BILLING_LABEL[t.billing].en.toLowerCase()})</td>
                <td className="num"><b>{formatMoney(t.amount, c.currency, t.billing)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(c.payment_terms.lo || c.payment_terms.en) && <Bi c={c.payment_terms} fields={fields} />}
        <Bi c={c.payment_general} fields={fields} />
      </section>
    ),
  };

  return (
    <article className="doc agreement">
      <header className="doc-head">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo, also used when printing */}
          <img src="/brand/logo.webp" alt="Atlas Advisory" width={130} className="doc-logo" />
          <div className="muted">{PROVIDER.name.en} · {PROVIDER.address.en}</div>
        </div>
        <div className="ag-title">
          <div lang="lo">{DOCUMENT_TITLE.lo}</div>
          <b>{DOCUMENT_TITLE.en.toUpperCase()}</b>
          <div className="muted">{agreementRef(a)}</div>
        </div>
      </header>

      <table className="doc-table ag-info">
        <tbody>
          <tr><th><span lang="lo">ເລກທີເອກະສານ</span> / Document No.</th><td>{agreementRef(a)}</td></tr>
          <tr><th><span lang="lo">ວັນທີ</span> / Date</th><td><span lang="lo">{longDate(date, "lo")}</span> / {longDate(date, "en")}</td></tr>
          <tr><th><span lang="lo">ຜູ້ສະໜອງບໍລິການ</span> / Service Provider</th><td>{PROVIDER.name.en}</td></tr>
          <tr><th><span lang="lo">ລູກຄ້າ</span> / Client</th><td>{c.client_name}</td></tr>
          <tr><th><span lang="lo">ໄລຍະເວລາການບໍລິການ</span> / Engagement Period</th>
            <td><span lang="lo">{longDate(a.start_date, "lo")} – {longDate(a.end_date, "lo")}</span><br />{longDate(a.start_date, "en")} – {longDate(a.end_date, "en")}</td></tr>
          <tr><th><span lang="lo">ຄ່າທຳນຽມລວມທັງໝົດ</span> / Total Fees</th><td>{totals.map((t) => formatMoney(t.amount, c.currency, t.billing)).join(" + ")}</td></tr>
          <tr><th><span lang="lo">ກຳນົດເວລາສັນຍາ</span> / Contract Duration</th><td><span lang="lo">{months} ເດືອນ</span> / {months} month{months > 1 ? "s" : ""}</td></tr>
          <tr><th><span lang="lo">ກົດໝາຍທີ່ນຳໃຊ້</span> / Governing Law</th><td><span lang="lo">ກົດໝາຍ ແຫ່ງ ສປປ ລາວ</span> / Laws of the Lao PDR</td></tr>
        </tbody>
      </table>

      {PARTS.map((part) => (
        <div key={part.no}>
          <h2><span lang="lo">ພາກທີ {part.no} — {part.title.lo}</span> / Part {part.no} — {part.title.en}</h2>
          {part.articles.map((no) => generated[no] ?? (byNo.get(no) && <ArticleBlock key={no} a={byNo.get(no)!} fields={fields} />))}
        </div>
      ))}

      <h2><span lang="lo">ລາຍເຊັນ</span> / Signatures</h2>
      <Bi c={SIGNATURE_INTRO} fields={fields} />
      <div className="ag-signatures">
        {[PROVIDER.name.en, c.client_name].map((party) => (
          <div key={party} className="ag-sign">
            <b>{party}</b>
            <div className="muted">Director / Authorised Signatory</div>
            <div className="ag-line"><span lang="lo">ລາຍເຊັນ</span> / Signature</div>
            <div className="ag-line"><span lang="lo">ຊື່ເຕັມ</span> / Full Name</div>
            <div className="ag-line"><span lang="lo">ຕຳແໜ່ງ</span> / Title</div>
            <div className="ag-line"><span lang="lo">ວັນທີ</span> / Date</div>
            <div className="ag-seal"><span lang="lo">ກາປະທັບ</span> / Company seal</div>
          </div>
        ))}
      </div>
    </article>
  );
}
