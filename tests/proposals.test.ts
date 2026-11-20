import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient, cleanupTestNotifications, resetAssessment, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 4: proposals. Who drafts, who sends, who decides, and that sent
// proposals can never change.
let fx: Fixtures;
let admin: SupabaseClient;
let consultant: SupabaseClient;
let ownerA: SupabaseClient;
let inquiryId: string;
let v1: string;
let v2: string;

const T = "(automated test)";
const item = (title: string, amount: number, billing = "fixed") => ({ service_id: "", title, scope: "", deliverables: "", billing, amount });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane" }).format(new Date());
const inDays = (n: number) => { const d = new Date(`${today()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function draft(client: SupabaseClient, createdBy: string, title: string) {
  const { data, error } = await client.from("proposals")
    .insert({ organization_id: fx.orgA, title, currency: "USD", valid_until: inDays(30), created_by: createdBy })
    .select("id").single();
  if (error) throw error;
  const items = await client.rpc("replace_proposal_items", { p_id: data.id, p_items: [item("Set-up", 1500), item("Bookkeeping", 250, "monthly")] });
  if (items.error) throw items.error;
  return data.id as string;
}

const statusOf = async (id: string) => (await serviceClient().from("proposals").select("status").eq("id", id).single()).data?.status;

beforeAll(async () => {
  fx = await setupFixtures();
  admin = await signInStaffWithMfa("staff");
  consultant = await signInStaffWithMfa("consultant");
  ownerA = await signInAs("ownerA");
  // Give Org A an originating inquiry so stage changes can be checked.
  const { data: ref } = await serviceClient().rpc("submit_inquiry", {
    p_company_name: `Proposal Co. ${T}`, p_contact_name: "Test", p_email: "cems-test-proposal@example.com", p_phone: "020 0000 0006",
    p_industry: "Retail", p_company_size: "", p_challenge: "Automated test inquiry, please ignore.", p_preferred_date: null,
    p_service_slugs: ["accounting"], p_ip_hash: `test-${randomUUID()}`,
  });
  inquiryId = (await serviceClient().from("inquiries").select("id").eq("reference", ref).single()).data!.id;
  await serviceClient().from("inquiries").update({ status: "pre_assessment" }).eq("id", inquiryId);
  await serviceClient().from("organizations").update({ source_inquiry_id: inquiryId }).eq("id", fx.orgA);
  await resetAssessment(fx.orgA);
});


afterAll(async () => {
  const svc = serviceClient();
  await svc.from("organizations").update({ source_inquiry_id: null }).eq("id", fx.orgA);
  await svc.from("proposals").delete().in("organization_id", [fx.orgA, fx.orgB]);
  await resetAssessment(fx.orgA);
  await svc.from("inquiries").delete().eq("id", inquiryId);
  await cleanupTestNotifications(fx.ids);
});

describe("drafting", () => {
  it("a consultant can create a draft with fee lines", async () => {
    v1 = await draft(consultant, fx.ids.consultant, `Accounting Services ${T}`);
    const { data } = await consultant.from("proposal_items").select("id").eq("proposal_id", v1);
    expect(data).toHaveLength(2);
  });

  it("clients never see drafts", async () => {
    expect(((await ownerA.from("proposals").select("id").eq("id", v1)).data ?? [])).toHaveLength(0);
    expect(((await ownerA.from("proposal_items").select("id").eq("proposal_id", v1)).data ?? [])).toHaveLength(0);
  });

  it("staff cannot set the status directly", async () => {
    expect((await admin.from("proposals").update({ status: "sent" }).eq("id", v1)).error).not.toBeNull();
  });
});

describe("sending", () => {
  it("a consultant cannot send", async () => {
    expect((await consultant.rpc("send_proposal", { p_id: v1 })).error?.message).toContain("not_allowed");
  });

  it("cannot be sent until the client's pre-assessment is approved", async () => {
    expect((await admin.rpc("send_proposal", { p_id: v1 })).error?.message).toContain("assessment_not_approved");
    // Approve Org A's pre-assessment for the rest of this file (the review flow itself is tested in assessments.test.ts).
    expect((await serviceClient().from("assessments").update({ status: "approved" }).eq("organization_id", fx.orgA)).error).toBeNull();
  });

  it("an admin sends; the inquiry moves to Proposal and the client is notified", async () => {
    expect((await admin.rpc("send_proposal", { p_id: v1 })).error).toBeNull();
    expect((await serviceClient().from("proposals").select("assessment_id").eq("id", v1).single()).data?.assessment_id).not.toBeNull();
    expect(await statusOf(v1)).toBe("sent");
    expect((await serviceClient().from("inquiries").select("status").eq("id", inquiryId).single()).data?.status).toBe("proposal");
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("type", "proposal_sent").eq("link", `/portal/proposals/${v1}`);
    expect(notes?.map((n) => n.user_id)).toEqual(expect.arrayContaining([fx.ids.ownerA, fx.ids.memberA]));
  });

  it("the client company sees it; other companies and visitors do not", async () => {
    expect(((await ownerA.from("proposals").select("id").eq("id", v1)).data ?? [])).toHaveLength(1);
    expect(((await ownerA.from("proposal_items").select("id").eq("proposal_id", v1)).data ?? [])).toHaveLength(2);
    const ownerB = await signInAs("ownerB");
    expect(((await ownerB.from("proposals").select("id").eq("id", v1)).data ?? [])).toHaveLength(0);
    expect(((await anonClient().from("proposals").select("id")).data ?? [])).toHaveLength(0);
  });
});

describe("a sent proposal is locked", () => {
  it("staff edits are ignored and the service key is refused", async () => {
    await admin.from("proposals").update({ title: "CHANGED" }).eq("id", v1);
    expect((await serviceClient().from("proposals").select("title").eq("id", v1).single()).data?.title).not.toBe("CHANGED");
    expect((await serviceClient().from("proposals").update({ title: "CHANGED" }).eq("id", v1)).error?.message).toContain("proposal_locked");
    expect((await serviceClient().from("proposal_items").update({ amount: 1 }).eq("proposal_id", v1)).error?.message).toContain("proposal_locked");
    expect((await admin.rpc("replace_proposal_items", { p_id: v1, p_items: [item("Cheaper", 1)] })).error).not.toBeNull();
  });

  it("a sent proposal cannot be deleted", async () => {
    await admin.from("proposals").delete().eq("id", v1);
    expect(await statusOf(v1)).toBe("sent");
  });
});

describe("responding", () => {
  it("a member or another company's owner cannot decide", async () => {
    const memberA = await signInAs("memberA");
    expect((await memberA.rpc("respond_to_proposal", { p_id: v1, p_accept: true })).error?.message).toContain("not_allowed");
    const ownerB = await signInAs("ownerB");
    expect((await ownerB.rpc("respond_to_proposal", { p_id: v1, p_accept: true })).error?.message).toContain("not_allowed");
  });

  it("an expired proposal cannot be accepted", async () => {
    const { data } = await serviceClient().from("proposals")
      .insert({ organization_id: fx.orgA, title: `Old offer ${T}`, currency: "USD", valid_until: inDays(-1), status: "sent", created_by: fx.ids.staff })
      .select("id").single();
    expect((await ownerA.rpc("respond_to_proposal", { p_id: data!.id, p_accept: true })).error?.message).toContain("expired");
  });
});

describe("revising", () => {
  it("revising creates v2 as a draft with the same lines, and reuses an open draft", async () => {
    const { data, error } = await consultant.rpc("revise_proposal", { p_id: v1 });
    expect(error).toBeNull();
    v2 = data as string;
    const { data: row } = await serviceClient().from("proposals").select("version, status, previous_id, proposal_items(id)").eq("id", v2).single();
    expect(row).toMatchObject({ version: 2, status: "draft", previous_id: v1 });
    expect(row?.proposal_items).toHaveLength(2);
    expect((await consultant.rpc("revise_proposal", { p_id: v1 })).data).toBe(v2);
  });

  it("sending v2 supersedes v1", async () => {
    expect((await admin.rpc("replace_proposal_items", { p_id: v2, p_items: [item("Set-up", 1200), item("Bookkeeping", 250, "monthly")] })).error).toBeNull();
    expect((await admin.rpc("send_proposal", { p_id: v2 })).error).toBeNull();
    expect(await statusOf(v1)).toBe("superseded");
    expect(await statusOf(v2)).toBe("sent");
    expect((await ownerA.rpc("respond_to_proposal", { p_id: v1, p_accept: true })).error?.message).toContain("not_open");
  });
});

describe("accepting", () => {
  it("the owner accepts; the inquiry moves to Agreement and Atlas is notified", async () => {
    expect((await ownerA.rpc("respond_to_proposal", { p_id: v2, p_accept: true })).error).toBeNull();
    const { data } = await serviceClient().from("proposals").select("status, responded_by").eq("id", v2).single();
    expect(data).toEqual({ status: "accepted", responded_by: fx.ids.ownerA });
    expect((await serviceClient().from("inquiries").select("status").eq("id", inquiryId).single()).data?.status).toBe("agreement");
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("type", "proposal_accepted").eq("link", `/admin/proposals/${v2}`);
    expect(notes?.map((n) => n.user_id)).toEqual(expect.arrayContaining([fx.ids.staff, fx.ids.consultant]));
  });

  it("cannot be accepted twice", async () => {
    expect((await ownerA.rpc("respond_to_proposal", { p_id: v2, p_accept: false })).error?.message).toContain("not_open");
  });
});

describe("declining and withdrawing", () => {
  it("the owner can decline with a reason", async () => {
    const id = await draft(admin, fx.ids.staff, `Advisory ${T}`);
    await admin.rpc("send_proposal", { p_id: id });
    expect((await ownerA.rpc("respond_to_proposal", { p_id: id, p_accept: false, p_reason: "Too expensive for now" })).error).toBeNull();
    const { data } = await serviceClient().from("proposals").select("status, decline_reason").eq("id", id).single();
    expect(data).toEqual({ status: "declined", decline_reason: "Too expensive for now" });
  });

  it("only an admin can withdraw a sent proposal", async () => {
    const id = await draft(admin, fx.ids.staff, `Startup ${T}`);
    await admin.rpc("send_proposal", { p_id: id });
    expect((await consultant.rpc("withdraw_proposal", { p_id: id })).error?.message).toContain("not_allowed");
    expect((await admin.rpc("withdraw_proposal", { p_id: id })).error).toBeNull();
    expect(await statusOf(id)).toBe("withdrawn");
  });
});
