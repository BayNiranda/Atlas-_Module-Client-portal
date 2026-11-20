import "server-only";
import { createClient } from "@/lib/supabase/server";

// All reads use the staff member's own session, so RLS (is_staff + MFA) applies.

type Named = { full_name: string | null; email: string | null } | null;
export const personName = (p: Named) => p?.full_name || p?.email || "—";

const LIST_COLUMNS =
  "id, reference, company_name, contact_name, source, status, created_at, assigned_to, " +
  "assignee:profiles!inquiries_assigned_to_fkey(full_name, email), inquiry_services(services(name, code))";

export type InquiryRow = {
  id: string; reference: string; company_name: string; contact_name: string; source: string;
  status: string; created_at: string; assigned_to: string | null; assignee: Named;
  inquiry_services: { services: { name: string; code: string } | null }[];
};

export async function listInquiries(filter: { stage?: string; owner?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("inquiries").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (filter.stage) q = q.eq("status", filter.stage);
  if (filter.owner === "unassigned") q = q.is("assigned_to", null);
  else if (filter.owner) q = q.eq("assigned_to", filter.owner);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as InquiryRow[];
}

export async function getInquiry(id: string) {
  const supabase = await createClient();
  const { data: inquiry, error } = await supabase
    .from("inquiries")
    .select(
      "*, assignee:profiles!inquiries_assigned_to_fkey(full_name, email), " +
        "creator:profiles!inquiries_created_by_fkey(full_name, email), " +
        "organization:organizations!inquiries_organization_id_fkey(id, name), inquiry_services(services(slug, name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!inquiry) return null;

  const [consultations, notes] = await Promise.all([
    supabase
      .from("consultations")
      .select("id, scheduled_at, mode, location, status, consultant:profiles!consultations_consultant_id_fkey(full_name, email)")
      .eq("inquiry_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("internal_notes")
      .select("id, body, created_at, author:profiles!internal_notes_author_id_fkey(full_name, email)")
      .eq("entity_type", "inquiry")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (consultations.error) throw consultations.error;
  if (notes.error) throw notes.error;

  return {
    inquiry: inquiry as unknown as InquiryDetail,
    consultations: consultations.data as unknown as ConsultationRow[],
    notes: notes.data as unknown as NoteRow[],
  };
}

export type InquiryDetail = {
  id: string; reference: string; company_name: string; contact_name: string; email: string | null;
  phone: string; industry: string | null; company_size: string | null; challenge: string;
  preferred_date: string | null; source: string; status: string; qualification: string | null;
  assigned_to: string | null; created_at: string; consent_at: string;
  assignee: Named; creator: Named; organization: { id: string; name: string } | null;
  inquiry_services: { services: { slug: string; name: string } | null }[];
};
export type ConsultationRow = { id: string; scheduled_at: string; mode: string; location: string | null; status: string; consultant: Named };
export type NoteRow = { id: string; body: string; created_at: string; author: Named };

export async function listStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, staff_role, is_active")
    .not("staff_role", "is", null)
    .order("full_name");
  if (error) throw error;
  return data;
}

export async function dashboardCounts() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [newCount, whatsappOpen, upcoming] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("source", "whatsapp").in("status", ["new", "discussion"]),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", now),
  ]);
  return { newCount: newCount.count ?? 0, whatsappOpen: whatsappOpen.count ?? 0, upcoming: upcoming.count ?? 0 };
}

export async function upcomingConsultations(limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultations")
    .select("id, scheduled_at, mode, inquiry:inquiries(id, company_name), consultant:profiles!consultations_consultant_id_fkey(full_name, email)")
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(limit);
  if (error) throw error;
  return data as unknown as { id: string; scheduled_at: string; mode: string; inquiry: { id: string; company_name: string } | null; consultant: Named }[];
}
