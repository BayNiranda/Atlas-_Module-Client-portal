"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { MANAGERS, staffForAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createInvitation, createSignInLink } from "@/lib/auth/invite";
import { MANUAL_STAGES } from "./labels";
import { waTo } from "./whatsapp";
import {
  type ActionResult, consultationSchema, consultationStatusSchema, convertSchema, firstError,
  leadSchema, noteSchema, updateInquirySchema,
} from "./admin-schema";

const NOT_ALLOWED: ActionResult = { error: "You do not have permission to do this." };
const SAVE_FAILED: ActionResult = { error: "Could not save. Please try again." };
const form = (fd: FormData) => Object.fromEntries(fd);

// Assign, stage, qualification. Coordinators and above (permission matrix).
export async function updateInquiry(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return NOT_ALLOWED;
  const parsed = updateInquirySchema.safeParse(form(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, status, assigned_to, qualification } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase.from("inquiries").select("status").eq("id", id).single();
  if (!current) return { error: "Inquiry not found." };
  // Stages after conversion move through their own steps, never by hand here.
  const manual = (MANUAL_STAGES as readonly string[]).includes(current.status);

  const { error } = await supabase
    .from("inquiries")
    .update({
      assigned_to: assigned_to || null,
      qualification: qualification || null,
      ...(manual && status ? { status } : {}),
    })
    .eq("id", id);
  if (error) return SAVE_FAILED;
  refresh();
  return { ok: true, message: "Saved. The change is in the activity log." };
}

// Any staff member may add notes (permission matrix).
export async function addInquiryNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await staffForAction();
  if (!user) return NOT_ALLOWED;
  const parsed = noteSchema.safeParse(form(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("internal_notes").insert({
    entity_type: "inquiry", entity_id: parsed.data.entity_id, body: parsed.data.body, author_id: user.id,
  });
  if (error) return SAVE_FAILED;
  refresh();
  return { ok: true, message: "Note added." };
}

// A lead that arrived on WhatsApp (or by referral) is typed in by staff.
export async function createLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await staffForAction(MANAGERS);
  if (!user) return NOT_ALLOWED;
  const parsed = leadSchema.safeParse({ ...form(fd), services: fd.getAll("services") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: services } = await supabase.from("services").select("id, slug").in("slug", d.services);
  if (!services || services.length !== d.services.length) return { error: "Choose at least one service" };

  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .insert({
      source: d.source, company_name: d.company_name, contact_name: d.contact_name, phone: d.phone,
      email: d.email ? d.email.toLowerCase() : null, challenge: d.challenge,
      // They contacted Atlas first, so contacting them back is expected.
      consent_at: new Date().toISOString(), created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !inquiry) return SAVE_FAILED;

  const linked = await supabase.from("inquiry_services").insert(services.map((s) => ({ inquiry_id: inquiry.id, service_id: s.id })));
  if (linked.error) return { error: "The lead was saved, but its services were not. Open it and add a note." };
  redirect(`/admin/inquiries/${inquiry.id}`);
}

// Every staff role may schedule and record consultations.
export async function scheduleConsultation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await staffForAction();
  if (!user) return NOT_ALLOWED;
  const parsed = consultationSchema.safeParse(form(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: inquiry } = await supabase.from("inquiries").select("organization_id").eq("id", d.inquiry_id).single();
  if (!inquiry) return { error: "Inquiry not found." };
  const { error } = await supabase.from("consultations").insert({
    inquiry_id: d.inquiry_id, organization_id: inquiry.organization_id, consultant_id: d.consultant_id,
    scheduled_at: d.scheduled_at, mode: d.mode, location: d.location || null, created_by: user.id,
  });
  if (error) return SAVE_FAILED;
  refresh();
  return { ok: true, message: "Consultation scheduled." };
}

export async function setConsultationStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction())) return NOT_ALLOWED;
  const parsed = consultationStatusSchema.safeParse(form(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("consultations").update({ status: parsed.data.status })
    .eq("id", parsed.data.id).eq("inquiry_id", parsed.data.inquiry_id);
  if (error) return SAVE_FAILED;
  refresh();
  return { ok: true };
}

// Create the client organization and its first user (CLIENT_OWNER), then hand
// staff a one-time invitation link to send. Coordinators and above.
export async function convertAndInvite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return NOT_ALLOWED;
  const parsed = convertSchema.safeParse(form(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: inquiry } = await supabase.from("inquiries").select("organization_id, status, phone").eq("id", d.inquiry_id).single();
  if (!inquiry) return { error: "Inquiry not found." };
  if (inquiry.organization_id) return { error: "This inquiry has already been converted." };
  if (inquiry.status === "not_a_fit" || inquiry.status === "spam") return { error: "Reopen the inquiry before converting it." };

  // Is there already a login with this email? (e.g. a person who is already a client elsewhere)
  const { data: existing } = await supabase.from("profiles").select("id, staff_role").eq("email", d.email).maybeSingle();
  if (existing?.staff_role) return { error: "That email belongs to an Atlas staff account. Use the client's own email." };

  let userId = existing?.id as string | undefined;
  let link: string | undefined;
  if (!userId) {
    try {
      ({ userId, link } = await createInvitation(d.email, d.full_name));
    } catch (e) {
      console.error("createInvitation failed", e);
      return { error: "Could not create the client's login. Please try again." };
    }
  }

  const { error } = await supabase.rpc("convert_inquiry", { p_inquiry_id: d.inquiry_id, p_client_user_id: userId, p_org_name: d.org_name });
  if (error) {
    console.error("convert_inquiry failed", error.message);
    return { error: error.message.includes("already_converted") ? "This inquiry has already been converted." : SAVE_FAILED.error };
  }
  // No refresh() here: refreshing would replace this form, and the link with it,
  // before staff can copy it. The result view has a "Done" button that reloads.

  if (!link) {
    return { ok: true, email: d.email, message: `${d.org_name} created. ${d.email} already has a login, so they can sign in now and will see the new organization.` };
  }
  const text = `Hello ${d.full_name}, this is Atlas Advisory. Here is your private link to set up your client portal account (valid for 24 hours, works once): ${link}`;
  return { ok: true, email: d.email, link, whatsapp: waTo(inquiry.phone, text) };
}

// New one-time sign-in link for the client owner of a converted inquiry
// (their invitation was lost or expired). Coordinators and above, client logins only.
export async function newClientSignInLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!(await staffForAction(MANAGERS))) return NOT_ALLOWED;
  const parsed = z.object({ inquiry_id: z.uuid() }).safeParse(form(fd));
  if (!parsed.success) return { error: "Inquiry not found." };

  const supabase = await createClient();
  const { data: inquiry } = await supabase.from("inquiries").select("organization_id, phone").eq("id", parsed.data.inquiry_id).single();
  if (!inquiry?.organization_id) return { error: "This inquiry has no client yet." };
  const { data: owner } = await supabase
    .from("organization_members")
    .select("profiles(email, full_name, staff_role)")
    .eq("organization_id", inquiry.organization_id)
    .eq("role", "CLIENT_OWNER")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const person = owner?.profiles as unknown as { email: string | null; full_name: string | null; staff_role: string | null } | null;
  if (!person?.email || person.staff_role) return { error: "No client owner login found for this organization." };

  let link: string;
  try {
    link = await createSignInLink(person.email);
  } catch (e) {
    console.error("createSignInLink failed", e);
    return { error: "Could not create a link. Please try again." };
  }
  const text = `Hello ${person.full_name ?? ""}, this is Atlas Advisory. Here is your private link to set your client portal password (valid for 24 hours, works once): ${link}`;
  return { ok: true, email: person.email, link, whatsapp: waTo(inquiry.phone, text) };
}
