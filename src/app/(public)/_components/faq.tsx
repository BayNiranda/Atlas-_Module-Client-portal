"use client";

import { useState } from "react";

const FAQS: [string, string][] = [
  ["Is the first discussion really free?", "Yes. The first WhatsApp conversation and consultation are free and without commitment. We only start work after you approve a proposal and sign an agreement."],
  ["Why do you need a pre-assessment before the proposal?", "Two companies with the same revenue can need very different amounts of work. The pre-assessment shows us your current records, systems and documents, so the fee in your proposal is accurate and you are not surprised later."],
  ["How is the price decided?", "The final fee depends on what the pre-assessment finds, such as transaction volume, number of bank accounts, payroll size and the state of past records. You receive it in a written proposal before any work starts."],
  ["Can you work in Lao and English?", "Yes. Reports, meetings and messages can be in Lao, English or both. This helps companies with foreign shareholders or managers."],
  ["Can I switch to Atlas from my current accountant?", "Yes. We collect your records, check opening balances and set up your books. You do not need to manage the handover yourself."],
  ["How do I send documents to you?", "Through your secure client portal. You can also share quick photos on WhatsApp, and we file them into the portal for you."],
  ["Is my financial information kept confidential?", "Yes. Documents are stored in a private, access-controlled portal. Only your authorised users and your assigned Atlas team can see them."],
];

export function Faq() {
  const [q, setQ] = useState("");
  const shown = FAQS.filter(([a, b]) => (a + b).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input className="faq-search" placeholder="Search questions…" aria-label="Search questions" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map(([question, answer], i) => (
        <details key={question} className="fq" open={i === 0 && !q}>
          <summary>{question}</summary>
          <div className="a">{answer}</div>
        </details>
      ))}
      {!shown.length && <p>No matching questions. Ask us on WhatsApp.</p>}
    </>
  );
}
