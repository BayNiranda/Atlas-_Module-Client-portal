"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { inspectUpload, isIssuedPath, removeUpload, uploadTarget } from "@/lib/storage/direct-upload";
import type { ActionResult } from "@/modules/inquiries/admin-schema";
import { getProposal } from "@/modules/proposals/queries";
import { proposalRef } from "@/modules/proposals/labels";
import { buildContent, type AgreementContent } from "./content";
import { AGREEMENT_KINDS, MAX_FILE_BYTES, safeDisplayName } from "./files";
import { getAgreement } from "./queries";

const BUCKET = "agreements";
const ERRORS: Record<string, string> = {
  not_allowed: "You do not have permission to do this.",
  proposal_not_accepted: "An agreement can only be prepared from an accepted proposal.",
  not_draft: "Only a draft can be issued.",
  not_open: "This agreement is not open for that step.",
  signed_file_missing: "Upload the fully signed copy before confirming.",
  reason_required: "Give a reason, so the client knows why.",
  cannot_revise: "This agreement cannot be revised.",
  agreement_locked: "An issued agreement cannot be changed. Create a new version instead.",
  agreement_file_locked: "A file has already been uploaded for this step.",
  bad_path: "The file could not be stored. Please try again.",
};
const explain = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Could not save. Please try again.";
const id = (fd: FormData) => z.uuid().safeParse(fd.get("id"));

async function staffRpc(fn: string, args: Record<string, unknown>, roles?: ("SUPER_ADMIN" | "ADMIN")[]): Promise<ActionResult> {
  if (!(await staffForAction(roles))) return { error: ERRORS.not_allowed };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true };
}

// Prepare from an accepted proposal (any staff member).
export async function prepareAgreement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const proposalId = z.uuid().safeParse(fd.get("proposal_id"));
  if (!proposalId.success) return { error: ERRORS.proposal_not_accepted };
  const p = await getProposal(proposalId.data);
  if (!p || p.status !== "accepted") return { error: ERRORS.proposal_not_accepted };

  const content = buildContent({
    clientName: p.organization?.name ?? "", proposalRef: proposalRef(p), currency: p.currency,
    paymentTerms: p.payment_terms ?? "", items: p.proposal_items,
  });
  // Default period: one year from today (Lao time); staff adjust it in the draft.
  const start = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane" }).format(new Date());
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_agreement", {
    p_proposal: p.id, p_title: p.title, p_start: start, p_end: end.toISOString().slice(0, 10), p_content: content,
  });
  if (error) return { error: explain(error.message) };
  redirect(`/admin/agreements/${data}`);
}

// Save a draft: title, period, Lao line titles, payment schedule in both languages.
const draftSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  start_date: z.iso.date("Choose a start date"),
  end_date: z.iso.date("Choose an end date"),
  payment_en: z.string().trim().max(5000),
  payment_lo: z.string().trim().max(5000),
}).refine((d) => d.end_date >= d.start_date, { message: "The end date must be after the start date." });

export async function saveAgreementDraft(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const parsed = draftSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const a = await getAgreement(parsed.data.id);
  if (!a || a.status !== "draft") return { error: ERRORS.agreement_locked };

  const content: AgreementContent = {
    ...a.content,
    items: a.content.items.map((it, i) => ({ ...it, title_lo: String(fd.get(`item_lo_${i}`) ?? "").trim().slice(0, 300) })),
    payment_terms: { en: parsed.data.payment_en, lo: parsed.data.payment_lo },
  };
  const supabase = await createClient();
  const { error } = await supabase.from("agreements")
    .update({ title: parsed.data.title, start_date: parsed.data.start_date, end_date: parsed.data.end_date, content })
    .eq("id", a.id);
  if (error) return { error: explain(error.message) };
  refresh();
  return { ok: true, message: "Draft saved." };
}

export async function issueAgreement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = id(fd);
  if (!v.success) return { error: ERRORS.not_open };
  const r = await staffRpc("issue_agreement", { p_id: v.data }, ["SUPER_ADMIN", "ADMIN"]);
  return r.ok ? { ok: true, message: "Issued. The client has been notified." } : r;
}

export async function confirmAgreementSigned(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = id(fd);
  if (!v.success) return { error: ERRORS.not_open };
  return staffRpc("confirm_agreement_signed", { p_id: v.data }, ["SUPER_ADMIN", "ADMIN"]);
}

export async function voidAgreement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = id(fd);
  if (!v.success) return { error: ERRORS.not_open };
  return staffRpc("void_agreement", { p_id: v.data, p_reason: String(fd.get("reason") ?? "") }, ["SUPER_ADMIN", "ADMIN"]);
}

export async function newAgreementVersion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const v = id(fd);
  if (!v.success) return { error: ERRORS.cannot_revise };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("new_agreement_version", { p_id: v.data });
  if (error) return { error: explain(error.message) };
  redirect(`/admin/agreements/${data}`);
}

export async function deleteAgreementDraft(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return { error: ERRORS.not_allowed };
  const v = id(fd);
  if (!v.success) return { error: ERRORS.not_open };
  const supabase = await createClient();
  const { error } = await supabase.from("agreements").delete().eq("id", v.data).eq("status", "draft");
  if (error) return { error: explain(error.message) };
  redirect("/admin/agreements");
}

// Upload a signed scan, straight from the browser to private storage.
//   kind "client": the client-signed copy (client owner, or staff on their behalf)
//   kind "signed": the copy signed by both parties (staff)
// Step 1 (startAgreementUpload): basic checks, then a one-time upload permission.
// Step 2 (finishAgreementUpload): check the stored file's content, then record it
// through the database function, which decides as the signed-in person whether
// it counts. If not, the stored file is removed.
export type UploadStart = { error?: string; bucket?: string; path?: string; token?: string };

async function uploadCaller(agreementId: string, kind: string) {
  const user = await getCurrentUser();
  if (!user || (user.staffRole && !user.mfaPassed)) return null;
  if (kind !== "client" && kind !== "signed") return null;
  if (kind === "signed" && !user.staffRole) return null;
  const a = await getAgreement(agreementId); // RLS: must be visible to this person
  return a ? { user, a } : null;
}

export async function startAgreementUpload(agreementId: string, kind: "client" | "signed"): Promise<UploadStart> {
  const caller = await uploadCaller(agreementId, kind);
  if (!caller) return { error: ERRORS.not_allowed };
  const open = kind === "client" ? caller.a.status === "issued" : ["issued", "client_signed"].includes(caller.a.status);
  if (!open) return { error: ERRORS.not_open };
  return uploadTarget(BUCKET, `${caller.a.organization_id}/${caller.a.id}`);
}

export async function finishAgreementUpload(agreementId: string, kind: "client" | "signed", path: string, fileName: string): Promise<ActionResult> {
  const caller = await uploadCaller(agreementId, kind);
  const folder = caller ? `${caller.a.organization_id}/${caller.a.id}` : "";
  if (!caller || !isIssuedPath(path, folder)) return { error: ERRORS.not_allowed };

  const file = await inspectUpload(BUCKET, path, fileName, AGREEMENT_KINDS, MAX_FILE_BYTES);
  if (!file.ok) return { error: file.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_agreement_file", {
    p_id: caller.a.id, p_kind: kind, p_path: path, p_name: safeDisplayName(fileName), p_sha256: file.sha256,
  });
  if (error) {
    await removeUpload(BUCKET, path); // not allowed or not open: do not keep the file
    return { error: explain(error.message) };
  }
  refresh();
  return { ok: true, message: kind === "client" ? "Uploaded. Atlas has been notified." : "Fully signed copy uploaded." };
}
