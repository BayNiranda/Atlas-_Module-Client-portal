"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/modules/inquiries/admin-schema";

type Start = { error?: string; bucket?: string; path?: string; token?: string };

// The browser's content type for the upload, from the file extension. The
// server checks the real content afterwards; this only has to match what
// private storage accepts.
const TYPES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", csv: "text/csv", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Props = {
  label: string;
  help: React.ReactNode;
  accept: string; // e.g. ".pdf,.jpg,.png"
  maxMb: number;
  start: () => Promise<Start>;
  finish: (path: string, fileName: string) => Promise<ActionResult>;
  inputId: string;
};

// Upload a file straight to private storage: ask permission, upload, then let
// the server check and record it.
export function DirectUpload({ label, help, accept, maxMb, start, finish, inputId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    setResult({});
    if (!file) return setResult({ error: "Choose a file to upload." });
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = TYPES[ext];
    if (!type || !accept.split(",").includes(`.${ext}`)) return setResult({ error: `Choose a ${accept.replaceAll(",", " / ")} file.` });
    if (file.size > maxMb * 1024 * 1024) return setResult({ error: `The file is larger than ${maxMb} MB.` });

    try {
      setBusy("Preparing…");
      const target = await start();
      if (target.error || !target.path || !target.token || !target.bucket) return setResult({ error: target.error ?? "Could not start the upload." });
      setBusy("Uploading…");
      const up = await createClient().storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { contentType: type });
      if (up.error) return setResult({ error: "The upload failed. Check your connection and try again." });
      setBusy("Checking the file…");
      const done = await finish(target.path, file.name);
      setResult(done);
      if (done.ok) {
        form.reset();
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={inputId} className="muted" style={{ display: "block", marginBottom: 6 }}>{help}</label>
      <input id={inputId} name="file" type="file" accept={accept} />
      <div className="actions">
        <button className="btn btn-p" type="submit" disabled={!!busy}>{busy ?? label}</button>
      </div>
      {result.error && <div className="msg err" role="alert">{result.error}</div>}
      {result.ok && result.message && <div className="msg ok" role="status">{result.message}</div>}
    </form>
  );
}
