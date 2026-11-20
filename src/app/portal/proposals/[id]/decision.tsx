"use client";

import { useState } from "react";
import { respondToProposal } from "@/modules/proposals/actions";
import { ActionForm } from "@/components/action-form";

// Accept / decline, shown only to owners of the company while the proposal is open.
export function Decision({ id, company }: { id: string; company: string }) {
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);

  if (!mode) {
    return (
      <div className="doc-actions">
        <button type="button" className="btn btn-p" onClick={() => setMode("accept")}>Accept proposal</button>
        <button type="button" className="btn btn-o" onClick={() => setMode("decline")}>Decline</button>
      </div>
    );
  }

  return (
    <ActionForm action={respondToProposal} submit={mode === "accept" ? "Confirm acceptance" : "Confirm decline"}
      done={(r) => <div className="msg ok" role="status">{r.message}</div>}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={mode} />
      {mode === "accept" ? (
        <label className="chk" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" required />
          <span>I confirm I may accept this proposal on behalf of {company}. I understand the engagement agreement will be signed separately.</span>
        </label>
      ) : (
        <div className="field">
          <label htmlFor="reason">Reason <span className="opt">(optional, helps Atlas improve the proposal)</span></label>
          <textarea id="reason" name="reason" maxLength={2000} />
        </div>
      )}
      <p style={{ marginTop: 8 }}><button type="button" className="btn btn-o btn-sm" onClick={() => setMode(null)}>Back</button></p>
    </ActionForm>
  );
}
