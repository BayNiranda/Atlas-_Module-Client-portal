import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agreementOrg, anonClient, serviceClient, setupFixtures, signInAs, type Fixtures } from "./fixtures";

// Module 9: full access test (design 6.9). Every table in the database is
// listed here by kind. A new table that is not added below, or that has its
// protection rules (RLS) off, fails this test.

// Rows carry organization_id; clients see their own company's only.
const ORG_SCOPED = ["agreements", "assessments", "document_requests", "documents", "organization_members", "projects", "proposals", "service_requests"];
// Atlas staff only; clients never read a single row.
const STAFF_ONLY = ["audit_log", "consultations", "inquiries", "inquiry_services", "internal_notes", "project_staff"];
// Reached through a parent row (proposal or project) of the client's company.
const CHILD = ["proposal_items", "tasks"];
// Own rows only (yourself, your companies, your notifications).
const PERSONAL = ["notifications", "organizations", "profiles"];
// Catalogue content, not client data: public services and published questionnaires.
const REFERENCE = ["services", "assessment_templates", "assessment_template_versions"];
const ALL = [...ORG_SCOPED, ...STAFF_ONLY, ...CHILD, ...PERSONAL, ...REFERENCE].sort();

let fx: Fixtures;
let org: string; // the permanent fake company, which has data in most tables
let outsider: SupabaseClient; // client of a different company
let member: SupabaseClient; // legitimate client of `org`
const svc = serviceClient();
const T = "(automated test)";
let taskId: string;
let requestId: string;
let projectId: string;
let consultationId: string;

beforeAll(async () => {
  fx = await setupFixtures();
  org = await agreementOrg(fx.ids);
  [outsider, member] = await Promise.all([signInAs("ownerB"), signInAs("agreementMember")]);
  // Make sure every kind of row exists, so "sees nothing" is a real result.
  // Newest project: projects.test.ts works on the oldest one, in parallel.
  const { data: project } = await svc.from("projects").select("id").eq("organization_id", org).order("created_at", { ascending: false }).limit(1).single();
  taskId = (await svc.from("tasks").insert({ project_id: project!.id, title: `Access check ${T}`, client_visible: true, created_by: fx.ids.staff }).select("id").single()).data!.id;
  requestId = (await svc.from("service_requests").insert({ organization_id: org, subject: `Access check ${T}`, description: "x", created_by: fx.ids.agreementMember }).select("id").single()).data!.id;
  projectId = project!.id;
  await svc.from("project_staff").upsert({ project_id: projectId, user_id: fx.ids.staff });
  const { data: inquiry } = await svc.from("inquiries").select("id").limit(1).single();
  consultationId = (await svc.from("consultations").insert({
    inquiry_id: inquiry!.id, organization_id: org, consultant_id: fx.ids.staff, scheduled_at: new Date().toISOString(), mode: "online", created_by: fx.ids.staff,
  }).select("id").single()).data!.id;
});

afterAll(async () => {
  await svc.from("tasks").delete().eq("id", taskId);
  await svc.from("service_requests").delete().eq("id", requestId);
  await svc.from("project_staff").delete().eq("project_id", projectId).eq("user_id", fx.ids.staff);
  await svc.from("consultations").delete().eq("id", consultationId);
});

describe("every table", () => {
  it("is known to this test and has its protection rules on", async () => {
    const { data, error } = await svc.rpc("table_security");
    expect(error).toBeNull();
    expect(data.map((t: { table_name: string }) => t.table_name).sort()).toEqual(ALL);
    expect(data.filter((t: { rls_enabled: boolean }) => !t.rls_enabled)).toEqual([]);
  });

  it("the table check itself is not open to signed-in users or visitors", async () => {
    expect((await member.rpc("table_security")).error).not.toBeNull();
    expect((await anonClient().rpc("table_security")).error).not.toBeNull();
  });
});

describe("security review fixes", () => {
  it("visitors see published services but cannot call the permission helpers", async () => {
    const anon = anonClient();
    expect((await anon.from("services").select("slug").limit(1)).data?.length).toBe(1);
    expect((await anon.rpc("is_staff")).error).not.toBeNull();
    expect((await anon.rpc("is_org_member", { org })).error).not.toBeNull();
  });

  it("the login service itself refuses passwords shorter than 12 characters", async () => {
    expect((await member.auth.updateUser({ password: "Short-pw-11" })).error).not.toBeNull();
  });
});

describe("logged-out visitor", () => {
  it.each(ALL.filter((t) => t !== "services"))("reads nothing from %s", async (table) => {
    const { data } = await anonClient().from(table).select("*").limit(1);
    expect(data ?? []).toEqual([]);
  });
});

describe("client of another company", () => {
  it.each(ORG_SCOPED)("cannot read or change %s of another company", async (table) => {
    const { count } = await svc.from(table).select("*", { count: "exact", head: true }).eq("organization_id", org);
    expect(count, `test data missing in ${table}`).toBeGreaterThan(0);
    expect((await outsider.from(table).select("*").eq("organization_id", org)).data ?? []).toEqual([]);
    const { data: changed } = await outsider.from(table).update({ organization_id: fx.orgB }).eq("organization_id", org).select("*");
    expect(changed ?? []).toEqual([]);
    expect((await outsider.from(table).insert({ organization_id: org })).error).not.toBeNull();
  });

  it("cannot read proposal lines or tasks of another company", async () => {
    const proposals = ((await svc.from("proposals").select("id").eq("organization_id", org)).data ?? []).map((p) => p.id);
    const projects = ((await svc.from("projects").select("id").eq("organization_id", org)).data ?? []).map((p) => p.id);
    expect((await svc.from("proposal_items").select("id").in("proposal_id", proposals)).data?.length).toBeGreaterThan(0);
    expect((await outsider.from("proposal_items").select("id").in("proposal_id", proposals)).data ?? []).toEqual([]);
    expect((await outsider.from("tasks").select("id").in("project_id", projects)).data ?? []).toEqual([]);
    expect((await member.from("tasks").select("id").eq("id", taskId)).data).toHaveLength(1); // its own client does see it
  });

  it("cannot read the company, its people or their notifications", async () => {
    expect((await outsider.from("organizations").select("id").eq("id", org)).data ?? []).toEqual([]);
    expect((await outsider.from("profiles").select("id").in("id", [fx.ids.agreementOwner, fx.ids.agreementMember])).data ?? []).toEqual([]);
    expect((await outsider.from("notifications").select("id").eq("user_id", fx.ids.agreementMember)).data ?? []).toEqual([]);
  });
});

describe("any client", () => {
  it.each(STAFF_ONLY)("reads nothing from staff-only %s", async (table) => {
    const { count } = await svc.from(table).select("*", { count: "exact", head: true });
    expect(count, `test data missing in ${table}`).toBeGreaterThan(0);
    expect((await member.from(table).select("*").limit(5)).data ?? []).toEqual([]);
  });
});

describe("private file storage", () => {
  it.each(["agreements", "documents"])("%s: clients cannot list or download files directly", async (bucket) => {
    const { data: files } = await svc.storage.from(bucket).list(org, { limit: 1 });
    expect(files?.length, `no test file in ${bucket}`).toBeGreaterThan(0);
    const path = `${org}/${files![0].name}`;
    for (const c of [member, outsider, anonClient()]) {
      expect((await c.storage.from(bucket).list(org)).data ?? []).toEqual([]);
      expect((await c.storage.from(bucket).download(path)).error).not.toBeNull();
      expect((await c.storage.from(bucket).createSignedUrl(path, 60)).error).not.toBeNull();
    }
  });
});
