import "server-only";
import { createClient } from "@/lib/supabase/server";

// RLS: staff see everything; clients see their company's projects and requests,
// and only tasks marked "client can see this".

type Person = { full_name: string | null; email: string | null } | null;
export type Project = {
  id: string; organization_id: string; agreement_id: string; name: string; status: string;
  coordinator_id: string | null; started_at: string | null; completed_at: string | null; created_at: string;
  organization: { name: string } | null; agreement: { number: string } | null; coordinator: Person;
};
export type Task = {
  id: string; project_id: string; title: string; description: string | null; status: string;
  assignee_id: string | null; due_date: string | null; client_visible: boolean; completed_at: string | null;
  assignee: Person;
};
export type ServiceRequest = {
  id: string; organization_id: string; project_id: string | null; subject: string; description: string; status: string;
  reply: string | null; replied_at: string | null; created_at: string;
  organization: { name: string } | null; project: { name: string } | null; author: Person;
};

const PROJECT_COLUMNS =
  "id, organization_id, agreement_id, name, status, coordinator_id, started_at, completed_at, created_at, " +
  "organization:organizations(name), agreement:agreements(number), coordinator:profiles!projects_coordinator_id_fkey(full_name, email)";
const TASK_COLUMNS =
  "id, project_id, title, description, status, assignee_id, due_date, client_visible, completed_at, " +
  "assignee:profiles!tasks_assignee_id_fkey(full_name, email)";
const REQUEST_COLUMNS =
  "id, organization_id, project_id, subject, description, status, reply, replied_at, created_at, " +
  "organization:organizations(name), project:projects(name), author:profiles!service_requests_created_by_fkey(full_name, email)";

export async function listProjects(filter: { orgId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (filter.orgId) q = q.eq("organization_id", filter.orgId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Project[];
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Project | null;
}

export async function listTasks(projectIds: string[]) {
  if (!projectIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS).in("project_id", projectIds)
    .order("due_date", { ascending: true, nullsFirst: false }).order("created_at");
  if (error) throw error;
  return data as unknown as Task[];
}

export async function projectTeam(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_staff").select("user_id").eq("project_id", projectId);
  if (error) throw error;
  return data.map((r) => r.user_id as string);
}

// Clients cannot read staff profiles, so the coordinator's name comes from here.
export async function coordinatorNames(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_coordinators", { p_org: orgId });
  if (error) throw error;
  return new Map((data as { project_id: string; coordinator: string }[]).map((r) => [r.project_id, r.coordinator]));
}

export async function listServiceRequests(filter: { orgId?: string; open?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase.from("service_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (filter.orgId) q = q.eq("organization_id", filter.orgId);
  if (filter.open) q = q.in("status", ["open", "in_review"]);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as ServiceRequest[];
}
