"use client";

import { finishAgreementUpload, startAgreementUpload } from "@/modules/agreements/actions";
import { DirectUpload } from "./direct-upload";

// Upload a signed scan (PDF, JPG or PNG, up to 10 MB). Checked again on the server.
export function AgreementUpload({ id, kind, label, help }: { id: string; kind: "client" | "signed"; label: string; help: string }) {
  return (
    <DirectUpload
      label={label}
      help={help}
      accept=".pdf,.jpg,.jpeg,.png"
      maxMb={10}
      inputId={`file-${kind}`}
      start={() => startAgreementUpload(id, kind)}
      finish={(path, name) => finishAgreementUpload(id, kind, path, name)}
    />
  );
}
