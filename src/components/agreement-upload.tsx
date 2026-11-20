"use client";

import { uploadAgreementFile } from "@/modules/agreements/actions";
import { ActionForm } from "./action-form";

// Upload a signed scan (PDF, JPG or PNG, up to 10 MB). Checked again on the server.
export function AgreementUpload({ id, kind, label, help }: { id: string; kind: "client" | "signed"; label: string; help: string }) {
  return (
    <ActionForm action={uploadAgreementFile} submit={label}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <label htmlFor={`file-${kind}`} className="muted" style={{ display: "block", marginBottom: 6 }}>{help}</label>
      <input id={`file-${kind}`} name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
    </ActionForm>
  );
}
