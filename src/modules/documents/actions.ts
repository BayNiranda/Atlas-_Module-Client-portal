"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { inspectUpload, isIssuedPath, removeUpload, uploadTarget } from "@/lib/storage/direct-upload";
import { DOCUMENT_KINDS, MAX_DOCUMENT_BYTES, safeDisplayName } from "@/modules/agreements/files";
import type { ActionResult } from "@/modules/inquiries/admin-schema";
import { CATEGORIES } from "./labels";

const BUCKET = "documents";
const ERRORS: Record<string, string> = {
  not_allowed: "You do not have permission to do this.",
  no_signed_agreement: "Document uploads open once your agreement with Atlas is signed.",
  request_not_open: "That request is no longer open.",
  already_reviewed: "This document has already been reviewed.",
  reason_required: "Explain what is wrong, so the client knows what to send instead.",
  bad_path: "The file could not be stored. Please try again.",
  not_found: "Not found.",
};
const explain = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Could not save. Please try again.";
const categories = CATEGORIES.map(([k]) => k) as [string, ...string[]];

const uploadSchema = z.object({
  orgId: z.uuid(),
  requestId: z.union([z.uuid(), z.null()]),
  category: z.enum(categories),
  visibility: z.enum(["client", "internal"]),
});
export type DocUpload = z.infer<typeof uploadSchema>;

// Step 1: the database decides whether this person may upload here; only then
// a one-time permission to write one location in the company's folder.
export async function startDocumentUpload(input: DocUpload) {
  const user = await getCurrentUser();
  if (!user || (user.staffRole && !user.mfaPassed)) return { error: ERRORS.not_allowed };
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { error: ERRORS.not_allowed };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("authorize_document_upload", { p_org: d.orgId, p_request: d.requestId, p_visibility: d.visibility });
  if (error) return { error: explain(error.message) };
  return uploadTarget(BUCKET, d.orgId);
}

// Step 2: check the stored file's real content, then record it (the database
// checks permission again). Anything not accepted is removed from storage.
export async function finishDocumentUpload(input: DocUpload, path: string, fileName: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = uploadSchema.safeParse(input);
  if (!user || !parsed.success || !isIssuedPath(path, parsed.data.orgId)) return { error: ERRORS.not_allowed };
  const d = parsed.data;

  const file = await inspectUpload(BUCKET, path, fileName, DOCUMENT_KINDS, MAX_DOCUMENT_BYTES);
  if (!file.ok) return { error: file.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_document", {
    p_org: d.orgId, p_request: d.requestId, p_category: d.category, p_visibility: d.visibility,
    p_path: path, p_name: safeDisplayName(fileName), p_mime: file.type, p_size: file.size, p_sha256: file.sha256,
  });
  if (error) {
    await removeUpload(BUCKET, path);
    return { error: explain(error.message) };
  }
  refresh();
  return { ok: true, message: user.staffRole ? "Uploaded." : "Uploaded. Atlas has been notified and will review it." };
}

const requestSchema = z.object({
  org_id: z.uuid(),
  title: z.string().trim().min(1, "Say which document you need").max(200),
  category: z.enum(categories),
  note: z.string().trim().max(2000),
  due_date: z.union([z.iso.date(), z.literal("")]),
});

export async function requestDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = requestSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_document", {
    p_org: d.org_id, p_title: d.title, p_category: d.category, p_note: d.note, p_due: d.due_date || null,
  });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Requested. The client has been notified." };
}

export async function cancelDocumentRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return { error: ERRORS.not_found };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_document_request", { p_id: id.data });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}

const reviewSchema = z.object({ id: z.uuid(), decision: z.enum(["accept", "reject"]), note: z.string().trim().max(2000).optional() });

export async function reviewDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = reviewSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_document", {
    p_id: parsed.data.id, p_accept: parsed.data.decision === "accept", p_note: parsed.data.note ?? null,
  });
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}
