import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures, cleanupTestNotifications } from "./fixtures";

// Module 2: who may do what with leads, notes, consultations, conversion and roles.
let fx: Fixtures;
let admin: SupabaseClient; // ADMIN role, MFA passed
let consultant: SupabaseClient; // CONSULTANT role, MFA passed
let superAdmin: SupabaseClient; // SUPER_ADMIN role, MFA passed
let inquiryId: string;
const createdInquiries: string[] = [];
const createdOrgs: string[] = [];

beforeAll(async () => {
  fx = await setupFixtures();
  admin = await signInStaffWithMfa("staff");
  consultant = await signInStaffWithMfa("consultant");
  superAdmin = await signInStaffWithMfa("superAdmin");

  // A web-form inquiry to work on, created the way the public form does it.
  const { data: ref, error } = await serviceClient().rpc("submit_inquiry", {
    p_company_name: "Fake Lead Co. (automated test)", p_contact_name: "Test Lead", p_email: "cems-test-lead@example.com",
    p_phone: "020 0000 0002", p_industry: "Retail", p_company_size: "", p_challenge: "Automated test inquiry, please ignore.",
    p_preferred_date: null, p_service_slugs: ["accounting"], p_ip_hash: `test-${randomUUID()}`,
  });
  if (error) throw error;
  const { data } = await serviceClient().from("inquiries").select("id").eq("reference", ref).single();
  inquiryId = data!.id;
  createdInquiries.push(inquiryId);
});

afterAll(async () => {
  await cleanupTestNotifications(fx.ids);
  const svc = serviceClient();
  await svc.from("inquiries").update({ organization_id: null }).in("id", createdInquiries);
  await svc.from("consultations").update({ organization_id: null }).in("inquiry_id", createdInquiries);
  for (const org of createdOrgs) {
    await svc.from("organization_members").delete().eq("organization_id", org);
    await svc.from("organizations").delete().eq("id", org);
  }
  await svc.from("internal_notes").delete().in("entity_id", createdInquiries);
  await svc.from("inquiries").delete().in("id", createdInquiries);
  // Put the consultant back, in case a role test failed half-way.
  await svc.from("profiles").update({ staff_role: "CONSULTANT", is_active: true }).eq("id", fx.ids.consultant);
});

describe("internal notes", () => {
  it("any staff member can add one, under their own name only", async () => {
    expect((await consultant.from("internal_notes").insert({ entity_type: "inquiry", entity_id: inquiryId, body: "Consultant note (test)", author_id: fx.ids.consultant })).error).toBeNull();
    const impersonation = await consultant.from("internal_notes").insert({ entity_type: "inquiry", entity_id: inquiryId, body: "Pretending to be admin", author_id: fx.ids.staff });
    expect(impersonation.error).not.toBeNull();
  });

  it("cannot be edited or deleted, even by an admin", async () => {
    const { data } = await admin.from("internal_notes").select("id").eq("entity_id", inquiryId).limit(1).single();
    expect((await admin.from("internal_notes").update({ body: "changed" }).eq("id", data!.id)).error).not.toBeNull();
    expect((await admin.from("internal_notes").delete().eq("id", data!.id)).error).not.toBeNull();
  });

  it("clients, visitors and staff without MFA cannot read them", async () => {
    const ownerA = await signInAs("ownerA");
    const noMfa = await signInAs("staff");
    for (const c of [anonClient(), ownerA, noMfa]) {
      expect((await c.from("internal_notes").select("id")).data ?? []).toHaveLength(0);
    }
  });
});

describe("consultations", () => {
  it("a consultant can schedule and update one", async () => {
    const { data, error } = await consultant.from("consultations").insert({
      inquiry_id: inquiryId, consultant_id: fx.ids.consultant, scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
      mode: "online", created_by: fx.ids.consultant,
    }).select("id").single();
    expect(error).toBeNull();
    expect((await consultant.from("consultations").update({ status: "completed" }).eq("id", data!.id)).error).toBeNull();
  });

  it("clients cannot see consultations", async () => {
    const ownerA = await signInAs("ownerA");
    expect((await ownerA.from("consultations").select("id")).data ?? []).toHaveLength(0);
  });
});

describe("managing inquiries", () => {
  it("a consultant cannot assign or change the stage", async () => {
    await consultant.from("inquiries").update({ status: "spam", assigned_to: fx.ids.consultant }).eq("id", inquiryId);
    const { data } = await serviceClient().from("inquiries").select("status, assigned_to").eq("id", inquiryId).single();
    expect(data).toEqual({ status: "new", assigned_to: null });
  });

  it("an admin can assign, qualify and change the stage", async () => {
    const { error } = await admin.from("inquiries").update({ status: "discussion", assigned_to: fx.ids.staff, qualification: "low" }).eq("id", inquiryId);
    expect(error).toBeNull();
    const { data } = await serviceClient().from("inquiries").select("status").eq("id", inquiryId).single();
    expect(data?.status).toBe("discussion");
  });

  it("an admin can log a WhatsApp lead as themselves, but not fake a web-form one", async () => {
    const lead = { company_name: "WhatsApp Lead Co. (test)", contact_name: "Test", phone: "020 0000 0003", challenge: "Needs bookkeeping", consent_at: new Date().toISOString() };
    const { data, error } = await admin.from("inquiries").insert({ ...lead, source: "whatsapp", created_by: fx.ids.staff }).select("id, reference").single();
    expect(error).toBeNull();
    expect(data?.reference).toMatch(/^INQ-/);
    createdInquiries.push(data!.id);

    expect((await admin.from("inquiries").insert({ ...lead, source: "web_form", created_by: fx.ids.staff })).error).not.toBeNull();
    expect((await admin.from("inquiries").insert({ ...lead, source: "whatsapp", created_by: fx.ids.consultant })).error).not.toBeNull();
  });

  it("a consultant cannot log leads", async () => {
    const { error } = await consultant.from("inquiries").insert({
      company_name: "x", contact_name: "x", phone: "020 0000 0004", challenge: "x", consent_at: new Date().toISOString(),
      source: "whatsapp", created_by: fx.ids.consultant,
    });
    expect(error).not.toBeNull();
  });
});

describe("converting an inquiry into a client", () => {
  it("a consultant is not allowed", async () => {
    const { error } = await consultant.rpc("convert_inquiry", { p_inquiry_id: inquiryId, p_client_user_id: fx.ids.convertClient, p_org_name: "Nope" });
    expect(error?.message).toContain("not_allowed");
  });

  it("an admin creates the organization, owner membership and moves the stage", async () => {
    const { data: orgId, error } = await admin.rpc("convert_inquiry", {
      p_inquiry_id: inquiryId, p_client_user_id: fx.ids.convertClient, p_org_name: "Converted Test Org (fake)",
    });
    expect(error).toBeNull();
    createdOrgs.push(orgId as string);

    const svc = serviceClient();
    const { data: inquiry } = await svc.from("inquiries").select("status, organization_id").eq("id", inquiryId).single();
    expect(inquiry).toEqual({ status: "pre_assessment", organization_id: orgId });
    const { data: member } = await svc.from("organization_members").select("role, status").eq("organization_id", orgId).single();
    expect(member).toEqual({ role: "CLIENT_OWNER", status: "active" });

    // The new client sees their organization, and only it.
    const client = await signInAs("convertClient");
    const { data: visible } = await client.from("organizations").select("id");
    expect(visible?.map((o) => o.id)).toEqual([orgId]);
  });

  it("cannot be converted twice", async () => {
    const { error } = await admin.rpc("convert_inquiry", { p_inquiry_id: inquiryId, p_client_user_id: fx.ids.convertClient, p_org_name: "Again" });
    expect(error?.message).toContain("already_converted");
  });
});

describe("staff roles", () => {
  it("nobody can change roles by editing profiles directly", async () => {
    expect((await superAdmin.from("profiles").update({ staff_role: "ADMIN" }).eq("id", fx.ids.consultant)).error).not.toBeNull();
  });

  it("only a super admin may use set_staff_access", async () => {
    const r = await admin.rpc("set_staff_access", { p_user_id: fx.ids.consultant, p_role: "ADMIN", p_active: true });
    expect(r.error?.message).toContain("not_allowed");
  });

  it("a super admin can change a role, and the change is logged", async () => {
    expect((await superAdmin.rpc("set_staff_access", { p_user_id: fx.ids.consultant, p_role: "PROJECT_COORDINATOR", p_active: true })).error).toBeNull();
    const { data: log } = await superAdmin.from("audit_log").select("metadata, actor_id").eq("entity_id", fx.ids.consultant)
      .order("id", { ascending: false }).limit(1).single();
    expect(log?.actor_id).toBe(fx.ids.superAdmin);
    expect((log?.metadata as { to_role: string }).to_role).toBe("PROJECT_COORDINATOR");
    expect((await superAdmin.rpc("set_staff_access", { p_user_id: fx.ids.consultant, p_role: "CONSULTANT", p_active: true })).error).toBeNull();
  });

  it("a super admin cannot change themselves or make a client into staff", async () => {
    expect((await superAdmin.rpc("set_staff_access", { p_user_id: fx.ids.superAdmin, p_role: "ADMIN", p_active: true })).error?.message).toContain("cannot_change_self");
    expect((await superAdmin.rpc("set_staff_access", { p_user_id: fx.ids.ownerA, p_role: "ADMIN", p_active: true })).error?.message).toContain("user_is_client");
  });
});
