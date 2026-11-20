"use client";

import { useState } from "react";
import { saveProposalDraft } from "@/modules/proposals/actions";
import { BILLING, CURRENCIES, formatMoney, parseAmount, totalsByBilling, type Billing, type Currency } from "@/modules/proposals/money";
import type { ProposalItemInput } from "@/modules/proposals/schema";
import { ActionForm } from "@/components/action-form";

type Props = {
  id?: string;
  orgs: { id: string; name: string }[];
  services: { id: string; name: string }[];
  initial: {
    organization_id: string; title: string; currency: Currency; valid_until: string;
    introduction: string; exclusions: string; payment_terms: string; terms: string;
    items: ProposalItemInput[];
  };
};

const emptyItem = (): ProposalItemInput => ({ service_id: "", title: "", scope: "", deliverables: "", billing: "fixed", amount: "" });

export function ProposalEditor({ id, orgs, services, initial }: Props) {
  const [items, setItems] = useState<ProposalItemInput[]>(initial.items.length ? initial.items : [emptyItem()]);
  const [currency, setCurrency] = useState<Currency>(initial.currency);

  const update = (i: number, patch: Partial<ProposalItemInput>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => setItems((list) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const valid = items.map((it) => parseAmount(it.amount, currency));
  const totals = totalsByBilling(items.flatMap((it, i) => (valid[i] === null ? [] : [{ billing: it.billing as Billing, amount: valid[i]! }])));

  return (
    <ActionForm action={saveProposalDraft} submit={id ? "Save draft" : "Create draft"}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="items_json" value={JSON.stringify(items)} />

      <div className="panel">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="organization_id">Client company</label>
            <select id="organization_id" name="organization_id" defaultValue={initial.organization_id} disabled={!!id} required>
              <option value="">Choose…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {/* A disabled select is not submitted; keep the value for saving existing drafts. */}
            {id && <input type="hidden" name="organization_id" value={initial.organization_id} />}
          </div>
          <div className="field full">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={initial.title} required maxLength={200} placeholder="e.g. Accounting Services" />
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="valid_until">Valid until</label>
            <input id="valid_until" name="valid_until" type="date" defaultValue={initial.valid_until} required />
          </div>
          <div className="field full">
            <label htmlFor="introduction">Introduction <span className="opt">(optional)</span></label>
            <textarea id="introduction" name="introduction" defaultValue={initial.introduction} maxLength={5000}
              placeholder="Following our consultation on…, we are pleased to set out our proposal." />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Scope of services and fees</h3>
        {items.map((it, i) => (
          <div className="item-row" key={i}>
            <div className="row-head">
              <b>Line {i + 1}</b>
              <span style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn btn-o btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move line ${i + 1} up`}>↑</button>
                <button type="button" className="btn btn-o btn-sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move line ${i + 1} down`}>↓</button>
                <button type="button" className="btn btn-o btn-sm" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor={`svc-${i}`}>Service <span className="opt">(optional)</span></label>
                <select id={`svc-${i}`} value={it.service_id} onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  update(i, { service_id: e.target.value, ...(s && !it.title ? { title: s.name } : {}) });
                }}>
                  <option value="">—</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`title-${i}`}>Line title</label>
                <input id={`title-${i}`} value={it.title} maxLength={200} onChange={(e) => update(i, { title: e.target.value })} placeholder="e.g. Monthly bookkeeping" />
              </div>
              <div className="field">
                <label htmlFor={`scope-${i}`}>What is included</label>
                <textarea id={`scope-${i}`} value={it.scope} maxLength={5000} onChange={(e) => update(i, { scope: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`del-${i}`}>Deliverables</label>
                <textarea id={`del-${i}`} value={it.deliverables} maxLength={5000} onChange={(e) => update(i, { deliverables: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`bill-${i}`}>Billing</label>
                <select id={`bill-${i}`} value={it.billing} onChange={(e) => update(i, { billing: e.target.value as Billing })}>
                  {BILLING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`amt-${i}`}>Fee ({currency})</label>
                <input id={`amt-${i}`} inputMode="decimal" value={it.amount} onChange={(e) => update(i, { amount: e.target.value })}
                  aria-invalid={it.amount !== "" && valid[i] === null} placeholder={currency === "LAK" ? "6,500,000" : "1,250"} />
                {it.amount !== "" && valid[i] === null && <small className="err" style={{ color: "var(--red)" }}>Not a valid amount{currency === "LAK" ? " (whole kip)" : ""}</small>}
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-o btn-sm" onClick={() => setItems((l) => [...l, emptyItem()])}>+ Add fee line</button>
        <div className="totals" aria-live="polite">
          {totals.map((t) => <span key={t.billing}>{formatMoney(t.amount, currency, t.billing)}</span>)}
        </div>
      </div>

      <div className="panel">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="exclusions">Not included</label>
            <textarea id="exclusions" name="exclusions" defaultValue={initial.exclusions} maxLength={5000} />
          </div>
          <div className="field full">
            <label htmlFor="payment_terms">Payment schedule</label>
            <textarea id="payment_terms" name="payment_terms" defaultValue={initial.payment_terms} maxLength={5000} />
          </div>
          <div className="field full">
            <label htmlFor="terms">Terms (blank line between paragraphs)</label>
            <textarea id="terms" name="terms" defaultValue={initial.terms} maxLength={20000} style={{ minHeight: 220 }} />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
