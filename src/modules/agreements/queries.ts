import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgreementContent } from "./content";

// RLS: staff see all; client members see their company's agreements, never drafts.
type Person = { full_name: string | null; email: string | null } | null;
export type Agreement = {
  id: string; organization_id: string; proposal_id: string; number: string; version: number; supersedes_id: string | null;
  title: string; start_date: string; end_date: string; content: AgreementContent; status: string;
  created_at: string; issued_at: string | null; confirmed_at: string | null; voided_at: string | null; void_reason: string | null;
  client_file_name: string | null; client_file_sha256: string | null; client_uploaded_at: string | null;
  signed_file_name: string | null; signed_file_sha256: string | null; signed_uploaded_at: string | null;
  organization: { name: string } | null;
  issuer: Person; confirmer: Person; client_uploader: Person; signed_uploader: Person; voider: Person;
};

const COLUMNS =
  "id, organization_id, proposal_id, number, version, supersedes_id, title, start_date, end_date, content, status, created_at, " +
  "issued_at, confirmed_at, voided_at, void_reason, client_file_name, client_file_sha256, client_uploaded_at, " +
  "signed_file_name, signed_file_sha256, signed_uploaded_at, organization:organizations(name), " +
  "issuer:profiles!agreements_issued_by_fkey(full_name, email), confirmer:profiles!agreements_confirmed_by_fkey(full_name, email), " +
  "client_uploader:profiles!agreements_client_uploaded_by_fkey(full_name, email), " +
  "signed_uploader:profiles!agreements_signed_uploaded_by_fkey(full_name, email), voider:profiles!agreements_voided_by_fkey(full_name, email)";

export async function getAgreement(id: string): Promise<Agreement | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("agreements").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Agreement | null;
}

export type AgreementRow = Pick<Agreement, "id" | "number" | "version" | "title" | "status" | "created_at" | "confirmed_at" | "organization">;

export async function listAgreements(filter: { orgId?: string; proposalId?: string } = {}): Promise<AgreementRow[]> {
  const supabase = await createClient();
  let q = supabase.from("agreements")
    .select("id, number, version, title, status, created_at, confirmed_at, organization:organizations(name)")
    .order("created_at", { ascending: false }).limit(500);
  if (filter.orgId) q = q.eq("organization_id", filter.orgId);
  if (filter.proposalId) q = q.eq("proposal_id", filter.proposalId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as AgreementRow[];
}

export const AGREEMENT_STATUS: Record<string, string> = {
  draft: "Draft", issued: "Awaiting client signature", client_signed: "Client signed",
  signed: "Signed", voided: "Cancelled", superseded: "Superseded",
};
export const agreementTone = (s: string) =>
  s === "signed" ? "green" : s === "voided" ? "red" : s === "superseded" ? "grey" : "gold";
export const agreementRef = (a: { number: string; version: number }) => `${a.number} v${a.version}`;
