import type { Proposal } from "@/modules/proposals/queries";
import { BILLING, formatMoney, totalsByBilling } from "@/modules/proposals/money";
import { fmtDate } from "@/modules/inquiries/labels";
import { proposalRef } from "@/modules/proposals/labels";

const billingLabel = (b: string) => BILLING.find(([k]) => k === b)?.[1] ?? b;

// Paragraph text typed by staff, shown as plain text (never as HTML).
function Paras({ text }: { text: string | null }) {
  if (!text?.trim()) return null;
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="doc-p">{p}</p>)}</>;
}

// The proposal exactly as the client sees it. Shared by staff preview and portal.
export function ProposalDocument({ p }: { p: Proposal }) {
  const totals = totalsByBilling(p.proposal_items);
  return (
    <article className="doc">
      <header className="doc-head">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo, also used when printing */}
          <img src="/brand/logo.webp" alt="Atlas Advisory" width={130} className="doc-logo" />
          <div className="muted">Atlas Advisory Co., Ltd. · Vientiane, Lao PDR</div>
        </div>
        <dl className="doc-meta">
          <dt>Proposal</dt><dd>{proposalRef(p)}</dd>
          <dt>Prepared for</dt><dd>{p.organization?.name}</dd>
          <dt>Date</dt><dd>{fmtDate(p.sent_at ?? p.created_at)}</dd>
          <dt>Valid until</dt><dd>{fmtDate(p.valid_until)}</dd>
        </dl>
      </header>

      <h1 className="doc-title">{p.title}</h1>
      <Paras text={p.introduction} />

      <h2>Scope of services and fees</h2>
      <table className="doc-table">
        <thead>
          <tr><th>Service</th><th>Deliverables</th><th className="num">Fee ({p.currency})</th></tr>
        </thead>
        <tbody>
          {p.proposal_items.map((i) => (
            <tr key={i.id}>
              <td>
                <b>{i.title}</b>
                {i.scope && <div className="doc-cell">{i.scope}</div>}
              </td>
              <td><div className="doc-cell">{i.deliverables ?? "—"}</div></td>
              <td className="num">
                {formatMoney(i.amount, p.currency, i.billing)}
                <small>{billingLabel(i.billing)}</small>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {totals.map((t) => (
            <tr key={t.billing}>
              <td colSpan={2}>Total {t.billing === "fixed" ? "fixed fees" : t.billing === "monthly" ? "monthly fees" : "yearly fees"}</td>
              <td className="num"><b>{formatMoney(t.amount, p.currency, t.billing)}</b></td>
            </tr>
          ))}
        </tfoot>
      </table>

      {p.exclusions?.trim() && (<><h2>Not included</h2><Paras text={p.exclusions} /></>)}
      {p.payment_terms?.trim() && (<><h2>Payment schedule</h2><Paras text={p.payment_terms} /></>)}
      {p.terms?.trim() && (<><h2>Terms</h2><Paras text={p.terms} /></>)}

      <p className="doc-p muted" style={{ marginTop: 24 }}>
        This proposal is open for acceptance until {fmtDate(p.valid_until)}. Accepting it in the client portal confirms
        the scope and fees; the engagement agreement is signed separately.
      </p>
    </article>
  );
}
