import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Definition } from "./answers";

// RLS: staff see all; clients only their own company's assessment.

type Person = { full_name: string | null; email: string | null } | null;
export type Assessment = {
  id: string; organization_id: string; status: string; answers: Answers;
  submitted_at: string | null; reviewed_at: string | null; review_comment: string | null; updated_at: string;
  organization: { name: string; source_inquiry_id: string | null } | null;
  submitter: Person; reviewer: Person;
  version: { version: number; definition: Definition } | null;
};

const COLUMNS =
  "id, organization_id, status, answers, submitted_at, reviewed_at, review_comment, updated_at, " +
  "organization:organizations(name, source_inquiry_id), " +
  "submitter:profiles!assessments_submitted_by_fkey(full_name, email), reviewer:profiles!assessments_reviewed_by_fkey(full_name, email), " +
  "version:assessment_template_versions(version, definition)";

export async function getAssessment(id: string): Promise<Assessment | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("assessments").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Assessment | null;
}

export async function getOrgAssessment(orgId: string): Promise<Assessment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assessments").select(COLUMNS).eq("organization_id", orgId).maybeSingle();
  if (error) throw error;
  return data as unknown as Assessment | null;
}

export async function listAssessments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id, status, submitted_at, reviewed_at, updated_at, organization:organizations(name)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as unknown as { id: string; status: string; submitted_at: string | null; reviewed_at: string | null; updated_at: string; organization: { name: string } | null }[];
}

export const ASSESSMENT_STATUS: Record<string, string> = {
  not_started: "Not started", in_progress: "In progress", submitted: "Submitted",
  changes_requested: "Changes requested", approved: "Approved",
};
export const assessmentTone = (s: string) =>
  s === "approved" ? "green" : s === "changes_requested" ? "red" : s === "submitted" ? "gold" : "grey";
