import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient, cleanupTestNotifications, resetAssessment, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 5: pre-assessment. Clients of the company fill in and submit; staff
// review; the database checks answers and locks approved ones.
type Def = { sections: { questions: { id: string; type: string; required: boolean; options?: string[]; min?: number }[] }[] };
const def = JSON.parse(readFileSync("supabase/seed-data/pre-assessment-v1.json", "utf8")) as Def;

// A complete, valid set of answers (first option for every choice question).
function completeAnswers() {
  const a: Record<string, string | string[]> = {};
  for (const q of def.sections.flatMap((s) => s.questions)) {
    if (!q.required) continue;
    if (q.type === "checkbox") a[q.id] = [q.options![0]];
    else if (q.type === "select" || q.type === "radio") a[q.id] = q.options![0];
    else if (q.type === "scale") a[q.id] = String(q.min ?? 1);
    else if (q.type === "consent") a[q.id] = "yes";
    else if (q.type === "email") a[q.id] = "cems-test@example.com";
    else if (q.type === "phone") a[q.id] = "020 0000 0007";
    else a[q.id] = "Test answer (automated test)";
  }
  return a;
}

let fx: Fixtures;
let memberA: SupabaseClient;
let admin: SupabaseClient;
let consultant: SupabaseClient;
let id: string;
const createdOrgs: string[] = [];

beforeAll(async () => {
  fx = await setupFixtures();
  memberA = await signInAs("memberA");
  admin = await signInStaffWithMfa("staff");
  consultant = await signInStaffWithMfa("consultant");
  await resetAssessment(fx.orgA);
  id = (await serviceClient().from("assessments").select("id").eq("organization_id", fx.orgA).single()).data!.id;
});

afterAll(async () => {
  await resetAssessment(fx.orgA);
  const svc = serviceClient();
  for (const org of createdOrgs) await svc.from("organizations").delete().eq("id", org);
  await svc.from("notifications").delete().like("title", "%Test Org A (fake)%");
  await cleanupTestNotifications(fx.ids);
});

const statusOf = async () => (await serviceClient().from("assessments").select("status").eq("id", id).single()).data?.status;

describe("opening", () => {
  it("every new client company gets a pre-assessment automatically, pinned to the published version", async () => {
    const { data: org } = await serviceClient().from("organizations").insert({ name: "Auto Assessment Co. (automated test)" }).select("id").single();
    createdOrgs.push(org!.id);
    const { data } = await serviceClient().from("assessments").select("status, version:assessment_template_versions(version, status)").eq("organization_id", org!.id).single();
    expect(data).toMatchObject({ status: "not_started", version: { version: 1, status: "published" } });
  });

  it("a published questionnaire version can never be edited", async () => {
    const { error } = await serviceClient().from("assessment_template_versions").update({ definition: {} }).eq("version", 1);
    expect(error?.message).toContain("template_version_locked");
  });
});

describe("who can see and write", () => {
  it("the company sees its own; other companies and visitors do not", async () => {
    expect(((await memberA.from("assessments").select("id").eq("id", id)).data ?? [])).toHaveLength(1);
    const ownerB = await signInAs("ownerB");
    expect(((await ownerB.from("assessments").select("id").eq("id", id)).data ?? [])).toHaveLength(0);
    expect(((await anonClient().from("assessments").select("id")).data ?? [])).toHaveLength(0);
  });

  it("nobody can write directly; another company's owner cannot save", async () => {
    expect((await memberA.from("assessments").update({ status: "approved" }).eq("id", id)).error).not.toBeNull();
    const ownerB = await signInAs("ownerB");
    expect((await ownerB.rpc("save_assessment", { p_id: id, p_answers: {} })).error?.message).toContain("not_allowed");
  });
});

describe("saving and submitting", () => {
  it("a member saves partial answers; status becomes In progress", async () => {
    expect((await memberA.rpc("save_assessment", { p_id: id, p_answers: { "1.1": "Test Member", "1.5": "WhatsApp" } })).error).toBeNull();
    expect(await statusOf()).toBe("in_progress");
  });

  it("the database rejects invalid answers, even when the website is bypassed", async () => {
    for (const bad of [{ "1.5": "Carrier pigeon" }, { "99.9": "x" }, { "2.4": "x".repeat(301) }, { "3.10": "9" }, { "2.10": "LAK" }]) {
      expect((await memberA.rpc("save_assessment", { p_id: id, p_answers: bad })).error?.message, JSON.stringify(bad)).toContain("invalid_answers");
    }
  });

  it("cannot submit with required questions missing", async () => {
    const { error } = await memberA.rpc("submit_assessment", { p_id: id, p_answers: { "1.1": "Only this" } });
    expect(error?.message).toContain("missing:");
    expect(await statusOf()).toBe("in_progress");
  });

  it("a complete submission is accepted and Atlas admins are notified", async () => {
    expect((await memberA.rpc("submit_assessment", { p_id: id, p_answers: completeAnswers() })).error).toBeNull();
    const { data } = await serviceClient().from("assessments").select("status, submitted_by").eq("id", id).single();
    expect(data).toEqual({ status: "submitted", submitted_by: fx.ids.memberA });
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("link", `/admin/assessments/${id}`);
    expect(notes?.map((n) => n.user_id)).toContain(fx.ids.staff);
  });

  it("cannot be changed after submitting", async () => {
    expect((await memberA.rpc("save_assessment", { p_id: id, p_answers: {} })).error?.message).toContain("not_editable");
  });
});

describe("review", () => {
  it("clients and staff without MFA cannot review", async () => {
    const ownerA = await signInAs("ownerA");
    expect((await ownerA.rpc("review_assessment", { p_id: id, p_approve: true })).error?.message).toContain("not_allowed");
    const noMfa = await signInAs("staff");
    expect((await noMfa.rpc("review_assessment", { p_id: id, p_approve: true })).error?.message).toContain("not_allowed");
  });

  it("asking for changes needs a comment, which the client sees", async () => {
    expect((await consultant.rpc("review_assessment", { p_id: id, p_approve: false })).error?.message).toContain("comment_required");
    expect((await consultant.rpc("review_assessment", { p_id: id, p_approve: false, p_comment: "Please add your VAT status." })).error).toBeNull();
    expect(((await memberA.from("assessments").select("status, review_comment").eq("id", id).single()).data)).toEqual({ status: "changes_requested", review_comment: "Please add your VAT status." });
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("type", "assessment_changes");
    expect(notes?.map((n) => n.user_id)).toContain(fx.ids.memberA);
  });

  it("the client updates and resubmits; staff approve and the answers lock", async () => {
    expect((await memberA.rpc("submit_assessment", { p_id: id, p_answers: { ...completeAnswers(), "4.2": "Yes" } })).error).toBeNull();
    expect((await admin.rpc("review_assessment", { p_id: id, p_approve: true })).error).toBeNull();
    expect(await statusOf()).toBe("approved");
    expect((await serviceClient().from("assessments").update({ answers: {} }).eq("id", id)).error?.message).toContain("assessment_locked");
    expect((await memberA.rpc("save_assessment", { p_id: id, p_answers: {} })).error?.message).toContain("not_editable");
  });
});
