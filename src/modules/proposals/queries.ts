import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Billing, Currency } from "./money";

// Reads use the signed-in person's session: RLS shows staff everything,
// clients only their own company's proposals and never drafts.

export type ProposalItem = {
  id: string; service_id: string | null; title: string; scope: string | null; deliverables: string | null;
  billing: Billing; amount: number; sort_order: number;
};
export type Proposal = {
  id: string; organization_id: string; number: string; version: number; title: string; currency: Currency;
  introduction: string | null; exclusions: string | null; payment_terms: string | null; terms: string | null;
  valid_until: string; status: string; created_at: string; sent_at: string | null; responded_at: string | null;
  decline_reason: string | null;
  organization: { name: string } | null;
  sender: { full_name: string | null; email: string | null } | null;
  responder: { full_name: string | null; email: string | null } | null;
  assessment_id: string | null;
  proposal_items: ProposalItem[];
};

const COLUMNS =
  "id, organization_id, number, version, title, currency, introduction, exclusions, payment_terms, terms, valid_until, " +
  "status, created_at, sent_at, responded_at, decline_reason, organization:organizations(name), " +
  "sender:profiles!proposals_sent_by_fkey(full_name, email), responder:profiles!proposals_responded_by_fkey(full_name, email), " +
  "assessment_id, " +
  "proposal_items(id, service_id, title, scope, deliverables, billing, amount, sort_order)";

export async function getProposal(id: string): Promise<Proposal | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data as unknown as Proposal;
  p.proposal_items.sort((a, b) => a.sort_order - b.sort_order);
  return p;
}

export type ProposalRow = Pick<Proposal, "id" | "number" | "version" | "title" | "currency" | "status" | "valid_until" | "created_at" | "sent_at" | "organization_id" | "organization">;

export async function listProposals(filter: { orgId?: string } = {}): Promise<ProposalRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("proposals")
    .select("id, number, version, title, currency, status, valid_until, created_at, sent_at, organization_id, organization:organizations(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter.orgId) q = q.eq("organization_id", filter.orgId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as ProposalRow[];
}

// Other versions with the same number (for "history").
export async function listVersions(number: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, version, status, valid_until, sent_at")
    .eq("number", number)
    .order("version", { ascending: false });
  if (error) throw error;
  return data;
}
