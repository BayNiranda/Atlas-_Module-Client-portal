import "server-only";
import { createClient } from "@/lib/supabase/server";

// RLS: staff see everything; clients see their company's requests and only
// "client"-visibility documents (internal ones never reach them).

type Person = { full_name: string | null; email: string | null } | null;
export type DocRequest = {
  id: string; organization_id: string; title: string; category: string; note: string | null; due_date: string | null;
  status: string; created_at: string; requester: Person;
};
export type Doc = {
  id: string; organization_id: string; request_id: string | null; category: string; file_name: string; mime_type: string;
  size_bytes: number; sha256: string; visibility: string; status: string; review_note: string | null; reviewed_at: string | null;
  created_at: string; uploaded_by: string; uploader: Person; reviewer: Person; organization: { name: string } | null;
  request: { title: string } | null;
};

const DOC_COLUMNS =
  "id, organization_id, request_id, category, file_name, mime_type, size_bytes, sha256, visibility, status, review_note, reviewed_at, created_at, uploaded_by, " +
  "uploader:profiles!documents_uploaded_by_fkey(full_name, email), reviewer:profiles!documents_reviewed_by_fkey(full_name, email), " +
  "organization:organizations(name), request:document_requests(title)";

export async function listRequests(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_requests")
    .select("id, organization_id, title, category, note, due_date, status, created_at, requester:profiles!document_requests_requested_by_fkey(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as DocRequest[];
}

export async function listDocuments(filter: { orgId?: string; status?: string }) {
  const supabase = await createClient();
  let q = supabase.from("documents").select(DOC_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (filter.orgId) q = q.eq("organization_id", filter.orgId);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Doc[];
}

// Owner's rule: clients upload only once an agreement is signed.
export async function hasSignedAgreement(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("agreements").select("id", { count: "exact", head: true })
    .eq("organization_id", orgId).in("status", ["signed", "superseded"]);
  return (count ?? 0) > 0;
}
