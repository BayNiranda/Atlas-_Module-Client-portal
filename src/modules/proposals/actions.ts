"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/modules/inquiries/admin-schema";
import { proposalFormSchema } from "./schema";
import { explainProposalError } from "./labels";

const NOT_ALLOWED: ActionResult = { error: "You do not have permission to do this." };

function parseForm(fd: FormData) {
  let items: unknown = [];
  try {
    items = JSON.parse(String(fd.get("items_json") ?? "[]"));
  } catch {
    items = null;
  }
  return proposalFormSchema.safeParse({ ...Object.fromEntries(fd), items });
}

// Create a new draft, or save an existing draft (any staff member may draft).
export async function saveProposalDraft(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return NOT_ALLOWED;
  const parsed = parseForm(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { items, organization_id, ...fields } = parsed.data;
  const existingId = z.uuid().safeParse(fd.get("id"));

  const supabase = await createClient();
  let id: string;
  if (existingId.success) {
    id = existingId.data;
    const { error } = await supabase.from("proposals").update(fields).eq("id", id);
    if (error) return { error: explainProposalError(error.message) };
  } else {
    const { data, error } = await supabase.from("proposals").insert({ ...fields, organization_id }).select("id").single();
    if (error || !data) return { error: explainProposalError(error?.message ?? "") };
    id = data.id;
  }

  const { error } = await supabase.rpc("replace_proposal_items", { p_id: id, p_items: items });
  if (error) return { error: explainProposalError(error.message) };
  if (!existingId.success) redirect(`/admin/proposals/${id}`);
  refresh();
  return { ok: true, message: "Draft saved." };
}

const idSchema = z.object({ id: z.uuid() });

async function callStaff(rpc: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, args);
  if (error) return { error: explainProposalError(error.message) };
  refresh();
  return { ok: true };
}

// Send: Admin / Super admin, only once the client's pre-assessment is approved (checked by the database).
export async function sendProposal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(["SUPER_ADMIN", "ADMIN"]))) return { error: "Only an Admin or Super admin can send proposals." };
  const parsed = idSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Proposal not found." };
  const result = await callStaff("send_proposal", { p_id: parsed.data.id });
  return result.ok ? { ok: true, message: "Sent. The client has been notified in the portal." } : result;
}

export async function withdrawProposal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(["SUPER_ADMIN", "ADMIN"]))) return NOT_ALLOWED;
  const parsed = idSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Proposal not found." };
  return callStaff("withdraw_proposal", { p_id: parsed.data.id });
}

export async function reviseProposal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return NOT_ALLOWED;
  const parsed = idSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Proposal not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revise_proposal", { p_id: parsed.data.id });
  if (error) return { error: explainProposalError(error.message) };
  redirect(`/admin/proposals/${data}`);
}

export async function deleteDraft(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return NOT_ALLOWED;
  const parsed = idSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Proposal not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("proposals").delete().eq("id", parsed.data.id).eq("status", "draft");
  if (error) return { error: explainProposalError(error.message) };
  redirect("/admin/proposals");
}

// Client owner accepts or declines. The database checks owner, status and expiry.
const respondSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["accept", "decline"]),
  reason: z.string().trim().max(2000).optional(),
});

export async function respondToProposal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.staffRole) return NOT_ALLOWED;
  const parsed = respondSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Please try again." };
  const { id, decision, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_proposal", { p_id: id, p_accept: decision === "accept", p_reason: reason ?? null });
  if (error) return { error: explainProposalError(error.message) };
  refresh();
  return {
    ok: true,
    message: decision === "accept"
      ? "Thank you. Your acceptance has been recorded and Atlas will prepare the engagement agreement."
      : "Your decision has been recorded. Atlas will be in touch.",
  };
}
