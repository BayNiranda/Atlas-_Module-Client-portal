"use client";

import { useState } from "react";
import { finishDocumentUpload, startDocumentUpload, type DocUpload } from "@/modules/documents/actions";
import { CATEGORIES, DOCUMENT_ACCEPT, type Category } from "@/modules/documents/labels";
import { DirectUpload } from "./direct-upload";

type Props = {
  orgId: string;
  requestId?: string;
  category?: Category; // fixed (e.g. from a request); otherwise the person chooses
  staff?: boolean; // staff may upload internal-only files
  label?: string;
  inputId: string;
};

export function DocumentUpload({ orgId, requestId, category, staff, label = "Upload", inputId }: Props) {
  const [cat, setCat] = useState<Category>(category ?? "other");
  const [visibility, setVisibility] = useState<"client" | "internal">("client");
  const input: DocUpload = { orgId, requestId: requestId ?? null, category: cat, visibility };

  return (
    <div>
      {(!category || staff) && (
        <div className="form-grid" style={{ marginBottom: 8 }}>
          {!category && (
            <div className="field">
              <label htmlFor={`${inputId}-cat`}>Category</label>
              <select id={`${inputId}-cat`} value={cat} onChange={(e) => setCat(e.target.value as Category)}>
                {CATEGORIES.filter(([k]) => staff || k !== "atlas_reports").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          )}
          {staff && (
            <div className="field">
              <label htmlFor={`${inputId}-vis`}>Who can see it</label>
              <select id={`${inputId}-vis`} value={visibility} onChange={(e) => setVisibility(e.target.value as "client" | "internal")}>
                <option value="client">Client and Atlas</option>
                <option value="internal">Atlas only (internal)</option>
              </select>
            </div>
          )}
        </div>
      )}
      <DirectUpload
        label={label}
        help="PDF, JPG, PNG, Excel, Word or CSV, up to 20 MB. Files with macros are not accepted."
        accept={DOCUMENT_ACCEPT}
        maxMb={20}
        inputId={inputId}
        start={() => startDocumentUpload(input)}
        finish={(path, name) => finishDocumentUpload(input, path, name)}
      />
    </div>
  );
}
