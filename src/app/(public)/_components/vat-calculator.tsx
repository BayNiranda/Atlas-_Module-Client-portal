"use client";

import { useState } from "react";

const VAT_RATE = 0.1;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// Pure arithmetic, exported for the unit test.
export function vatSplit(amount: number, mode: "add" | "remove") {
  if (mode === "add") return { net: amount, vat: amount * VAT_RATE, gross: amount * (1 + VAT_RATE) };
  const net = amount / (1 + VAT_RATE);
  return { net, vat: amount - net, gross: amount };
}

export function VatCalculator() {
  const [raw, setRaw] = useState("1,000,000");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const amount = parseFloat(raw.replace(/,/g, "")) || 0;
  const r = vatSplit(amount, mode);

  return (
    <div className="tool">
      <h3>VAT calculator</h3>
      <div className="lo">ຄິດໄລ່ອາກອນມູນຄ່າເພີ່ມ</div>
      <div className="calc">
        <div className="field">
          <label htmlFor="vatAmt">Amount (LAK)</label>
          <input id="vatAmt" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} />
        </div>
        <div className="seg" role="group" aria-label="VAT mode">
          <button type="button" aria-pressed={mode === "add"} onClick={() => setMode("add")}>Add VAT</button>
          <button type="button" aria-pressed={mode === "remove"} onClick={() => setMode("remove")}>Remove VAT</button>
        </div>
      </div>
      <div className="res" aria-live="polite">
        <div><span>Before VAT</span><b>{fmt(r.net)}</b></div>
        <div><span>VAT 10%</span><b>{fmt(r.vat)}</b></div>
        <div><span>Including VAT</span><b>{fmt(r.gross)}</b></div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink3)", margin: "12px 0 0" }}>
        Uses the standard 10% rate. Some goods and services are exempt. Ask us if unsure.
      </p>
    </div>
  );
}
