import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agreementOrg, cleanupTestNotifications, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 8: projects. Projects are never deleted, so tests use the permanent
// fake company (its signed agreement already has projects) and put the
// project back the way they found it.
let fx: Fixtures;
let org: string;
let projectId: string;
let admin: SupabaseClient;
let consultant: SupabaseClient;
let member: SupabaseClient;
let ownerB: SupabaseClient;
const svc = serviceClient();
const T = "(automated test)";

beforeAll(async () => {
  fx = await setupFixtures();
  org = await agreementOrg(fx.ids);
  [admin, consultant, member, ownerB] = await Promise.all([
    signInStaffWithMfa("staff"), signInStaffWithMfa("consultant"), signInAs("agreementMember"), signInAs("ownerB"),
  ]);
  const { data } = await svc.from("projects").select("id").eq("organization_id", org).order("created_at").limit(1).single();
  expect(data, "agreement test company must have a signed agreement; run agreements.test.ts").toBeTruthy();
  projectId = data!.id;
  await svc.from("project_staff").delete().eq("project_id", projectId);
  await svc.from("projects").update({ coordinator_id: null, status: "onboarding" }).eq("id", projectId);
});

afterAll(async () => {
  await svc.from("tasks").delete().eq("project_id", projectId);
  await svc.from("project_staff").delete().eq("project_id", projectId);
  await svc.from("projects").update({ coordinator_id: null, status: "onboarding", started_at: null, completed_at: null }).eq("id", projectId);
  await svc.from("service_requests").delete().like("subject", `%${T}%`);
  // These go to every manager, including the owner's real account.
  await svc.from("notifications").delete().like("title", "New request: Agreement Test Co.%");
  await svc.from("notifications").delete().like("title", "New projects: Agreement Test Co.%");
  await cleanupTestNotifications(fx.ids);
});

describe("projects from signed agreements", () => {
  // Per line, not per agreement version: a signed amendment keeps the projects
  // made from the first signed version.
  it("every line of a signed agreement's proposal has exactly one project", async () => {
    const { data: signed } = await svc.from("agreements").select("proposal_id").eq("organization_id", org).eq("status", "signed");
    for (const a of signed ?? []) {
      const { data: lines } = await svc.from("proposal_items").select("id").eq("proposal_id", a.proposal_id);
      const { data: made } = await svc.from("projects").select("proposal_item_id").in("proposal_item_id", (lines ?? []).map((l) => l.id));
      expect(made?.length).toBe(lines?.length);
    }
  });

  it("clients see their own company's projects only, and change nothing directly", async () => {
    expect((await member.from("projects").select("id").eq("id", projectId)).data).toHaveLength(1);
    expect((await ownerB.from("projects").select("id").eq("id", projectId)).data).toHaveLength(0);
    expect((await member.from("projects").update({ status: "completed" }).eq("id", projectId).select("id")).data ?? []).toHaveLength(0);
    expect((await member.rpc("set_project_status", { p_id: projectId, p_status: "completed" })).error?.message).toContain("not_allowed");
    expect((await svc.from("projects").delete().eq("id", projectId)).error?.message).toContain("project_locked");
  });
});

describe("stage and team", () => {
  it("consultants cannot change the stage or the team", async () => {
    expect((await consultant.rpc("set_project_status", { p_id: projectId, p_status: "in_delivery" })).error?.message).toContain("not_allowed");
    expect((await consultant.rpc("set_project_team", { p_id: projectId, p_coordinator: fx.ids.consultant, p_staff: [] })).error?.message).toContain("not_allowed");
  });

  it("only staff can be on a team; added staff are told", async () => {
    expect((await admin.rpc("set_project_team", { p_id: projectId, p_coordinator: fx.ids.agreementMember, p_staff: [] })).error?.message).toContain("not_staff");
    expect((await admin.rpc("set_project_team", { p_id: projectId, p_coordinator: fx.ids.staff, p_staff: [fx.ids.consultant] })).error).toBeNull();
    const { data } = await svc.from("notifications").select("user_id").eq("type", "project_assigned").eq("user_id", fx.ids.consultant);
    expect(data?.length).toBeGreaterThan(0);
  });

  it("moving the stage records the start and tells the client", async () => {
    expect((await admin.rpc("set_project_status", { p_id: projectId, p_status: "in_delivery" })).error).toBeNull();
    expect((await member.from("projects").select("status, started_at").eq("id", projectId).single()).data?.started_at).toBeTruthy();
    const { data } = await svc.from("notifications").select("user_id").eq("type", "project_status").eq("user_id", fx.ids.agreementMember);
    expect(data?.length).toBeGreaterThan(0);
  });

  it("clients see the coordinator's name only, other companies nothing", async () => {
    const { data } = await member.rpc("project_coordinators", { p_org: org });
    expect(data).toContainEqual({ project_id: projectId, coordinator: "Test Staff Admin" });
    expect((await ownerB.rpc("project_coordinators", { p_org: org })).data).toEqual([]);
    expect((await member.from("project_staff").select("user_id")).data).toEqual([]);
  });
});

describe("tasks", () => {
  let internalTask: string;
  let sharedTask: string;

  it("staff on the project manage tasks; others cannot", async () => {
    const add = (c: SupabaseClient, over: Record<string, unknown> = {}) =>
      c.from("tasks").insert({ project_id: projectId, title: `Reconcile bank ${T}`, ...over }).select("id").single();
    expect((await add(member)).error).not.toBeNull();
    internalTask = (await add(consultant)).data!.id; // consultant is on the team now
    sharedTask = (await add(admin, { client_visible: true, title: `Monthly report ${T}` })).data!.id;
    expect((await add(admin, { assignee_id: fx.ids.agreementMember })).error?.message).toContain("assignee_not_staff");

    // Off the team, the consultant can no longer touch tasks.
    await admin.rpc("set_project_team", { p_id: projectId, p_coordinator: fx.ids.staff, p_staff: [] });
    expect((await consultant.from("tasks").update({ status: "done" }).eq("id", internalTask).select("id")).data ?? []).toHaveLength(0);
    expect((await add(consultant)).error).not.toBeNull();
  });

  it("clients see only tasks marked for them, and only their company's", async () => {
    const seen = ((await member.from("tasks").select("id").eq("project_id", projectId)).data ?? []).map((t) => t.id);
    expect(seen).toContain(sharedTask);
    expect(seen).not.toContain(internalTask);
    expect((await ownerB.from("tasks").select("id").eq("project_id", projectId)).data).toEqual([]);
  });

  it("done tasks get a finish time", async () => {
    await admin.from("tasks").update({ status: "done" }).eq("id", sharedTask);
    expect((await member.from("tasks").select("completed_at").eq("id", sharedTask).single()).data?.completed_at).toBeTruthy();
    await admin.from("tasks").update({ status: "in_progress" }).eq("id", sharedTask);
    expect((await member.from("tasks").select("completed_at").eq("id", sharedTask).single()).data?.completed_at).toBeNull();
  });
});

describe("service requests", () => {
  let requestId: string;

  it("clients raise requests for their own company; Atlas is told", async () => {
    expect((await ownerB.rpc("raise_service_request", { p_org: org, p_project: null, p_subject: `x ${T}`, p_description: "x" })).error?.message).toContain("not_allowed");
    const { data, error } = await member.rpc("raise_service_request", {
      p_org: org, p_project: projectId, p_subject: `Payroll for 3 new staff ${T}`, p_description: "From next month.",
    });
    expect(error).toBeNull();
    requestId = data as string;
    const { data: notes } = await svc.from("notifications").select("user_id").eq("type", "service_request").eq("user_id", fx.ids.staff);
    expect(notes?.length).toBeGreaterThan(0);
    expect((await ownerB.from("service_requests").select("id").eq("id", requestId)).data).toEqual([]);
  });

  it("coordinator and above answer; the client sees the reply", async () => {
    expect((await consultant.rpc("answer_service_request", { p_id: requestId, p_status: "resolved", p_reply: "x" })).error?.message).toContain("not_allowed");
    expect((await member.rpc("answer_service_request", { p_id: requestId, p_status: "closed", p_reply: "x" })).error?.message).toContain("not_allowed");
    expect((await admin.rpc("answer_service_request", { p_id: requestId, p_status: "in_review", p_reply: "We will add this from December." })).error).toBeNull();
    expect((await member.from("service_requests").select("status, reply").eq("id", requestId).single()).data)
      .toEqual({ status: "in_review", reply: "We will add this from December." });
  });
});
