import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient, cleanupTestNotifications, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 3: notifications, colleagues (add/revoke), co-member names, overview.
let fx: Fixtures;
let ownerA: SupabaseClient;
let admin: SupabaseClient;
const createdInquiries: string[] = [];

beforeAll(async () => {
  fx = await setupFixtures();
  ownerA = await signInAs("ownerA");
  admin = await signInStaffWithMfa("staff");
  // Start clean: convertClient must not be in Org A or Org B.
  await serviceClient().from("organization_members").delete().eq("user_id", fx.ids.convertClient).in("organization_id", [fx.orgA, fx.orgB]);
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("organization_members").delete().eq("user_id", fx.ids.convertClient).in("organization_id", [fx.orgA, fx.orgB]);
  await svc.from("organization_members").update({ status: "active" }).eq("organization_id", fx.orgA).eq("user_id", fx.ids.ownerA);
  await svc.from("inquiries").delete().in("id", createdInquiries);
  await cleanupTestNotifications(fx.ids);
});

async function notificationsOf(key: "staff" | "consultant" | "superAdmin" | "ownerA" | "convertClient", type: string) {
  const { data } = await serviceClient().from("notifications").select("title, link, user_id").eq("user_id", fx.ids[key]).eq("type", type);
  return data ?? [];
}

describe("notifications", () => {
  let ref: string;

  it("a new web inquiry notifies coordinators and above, not consultants or clients", async () => {
    const { data, error } = await serviceClient().rpc("submit_inquiry", {
      p_company_name: "Notify Co. (automated test)", p_contact_name: "Test", p_email: "cems-test-notify@example.com",
      p_phone: "020 0000 0005", p_industry: "Retail", p_company_size: "", p_challenge: "Automated test inquiry, please ignore.",
      p_preferred_date: null, p_service_slugs: ["accounting"], p_ip_hash: `test-${randomUUID()}`,
    });
    expect(error).toBeNull();
    ref = data as string;
    const { data: row } = await serviceClient().from("inquiries").select("id").eq("reference", ref).single();
    createdInquiries.push(row!.id);

    expect((await notificationsOf("staff", "inquiry_new")).some((n) => n.title.includes(ref))).toBe(true);
    expect((await notificationsOf("superAdmin", "inquiry_new")).some((n) => n.title.includes(ref))).toBe(true);
    expect((await notificationsOf("consultant", "inquiry_new")).some((n) => n.title.includes(ref))).toBe(false);
    expect((await notificationsOf("ownerA", "inquiry_new"))).toHaveLength(0);
  });

  it("assigning an inquiry notifies the person assigned", async () => {
    expect((await admin.from("inquiries").update({ assigned_to: fx.ids.consultant }).eq("id", createdInquiries[0])).error).toBeNull();
    const n = await notificationsOf("consultant", "inquiry_assigned");
    expect(n.some((x) => x.title.includes(ref) && x.link === `/admin/inquiries/${createdInquiries[0]}`)).toBe(true);
  });

  it("people see only their own notifications, and can only mark them read", async () => {
    const consultant = await signInStaffWithMfa("consultant");
    const mine = (await consultant.from("notifications").select("id, user_id")).data ?? [];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((n) => n.user_id === fx.ids.consultant)).toBe(true);
    // ownerA sees none of the staff notifications.
    expect(((await ownerA.from("notifications").select("user_id")).data ?? []).every((n) => n.user_id === fx.ids.ownerA)).toBe(true);

    expect((await consultant.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine[0].id)).error).toBeNull();
    expect((await consultant.from("notifications").update({ title: "changed" }).eq("id", mine[0].id)).error).not.toBeNull();
    expect((await consultant.from("notifications").insert({ user_id: fx.ids.consultant, type: "x", title: "fake" })).error).not.toBeNull();
    expect(((await anonClient().from("notifications").select("id")).data ?? [])).toHaveLength(0);
  });

  it("links must stay inside the app", async () => {
    const { error } = await serviceClient().from("notifications").insert({ user_id: fx.ids.staff, type: "x", title: "x", link: "//evil.example.com" });
    expect(error).not.toBeNull();
  });
});

describe("colleagues", () => {
  it("another company's owner cannot add people to Org A (the fixed bug)", async () => {
    const ownerB = await signInAs("ownerB");
    const { error } = await ownerB.rpc("add_org_member", { p_org: fx.orgA, p_user: fx.ids.ownerB, p_role: "CLIENT_OWNER" });
    expect(error?.message).toContain("not_allowed");
  });

  it("a member (not owner) cannot add people", async () => {
    const memberA = await signInAs("memberA");
    const { error } = await memberA.rpc("add_org_member", { p_org: fx.orgA, p_user: fx.ids.convertClient, p_role: "CLIENT_MEMBER" });
    expect(error?.message).toContain("not_allowed");
  });

  it("a consultant cannot add people, and nobody can add a staff account as a client", async () => {
    const consultant = await signInStaffWithMfa("consultant");
    expect((await consultant.rpc("add_org_member", { p_org: fx.orgA, p_user: fx.ids.convertClient, p_role: "CLIENT_MEMBER" })).error?.message).toContain("not_allowed");
    expect((await ownerA.rpc("add_org_member", { p_org: fx.orgA, p_user: fx.ids.consultant, p_role: "CLIENT_MEMBER" })).error?.message).toContain("user_is_staff");
  });

  it("the owner adds a colleague, who is welcomed and sees the company", async () => {
    expect((await ownerA.rpc("add_org_member", { p_org: fx.orgA, p_user: fx.ids.convertClient, p_role: "CLIENT_MEMBER" })).error).toBeNull();
    expect((await notificationsOf("convertClient", "portal_welcome")).length).toBeGreaterThan(0);
    const colleague = await signInAs("convertClient");
    expect(((await colleague.from("organizations").select("id").eq("id", fx.orgA)).data ?? [])).toHaveLength(1);
  });

  it("members can see co-workers' names, but not other companies' people", async () => {
    const memberA = await signInAs("memberA");
    expect(((await memberA.from("profiles").select("id").eq("id", fx.ids.ownerA)).data ?? [])).toHaveLength(1);
    expect(((await memberA.from("profiles").select("id").eq("id", fx.ids.ownerB)).data ?? [])).toHaveLength(0);
  });

  it("the owner removes the colleague, who loses access at once", async () => {
    expect((await ownerA.rpc("revoke_org_member", { p_org: fx.orgA, p_user: fx.ids.convertClient })).error).toBeNull();
    const colleague = await signInAs("convertClient");
    expect(((await colleague.from("organizations").select("id").eq("id", fx.orgA)).data ?? [])).toHaveLength(0);
  });

  it("an owner cannot remove themselves, and the last owner cannot be removed", async () => {
    expect((await ownerA.rpc("revoke_org_member", { p_org: fx.orgA, p_user: fx.ids.ownerA })).error?.message).toContain("cannot_remove_self");
    expect((await admin.rpc("revoke_org_member", { p_org: fx.orgA, p_user: fx.ids.ownerA })).error?.message).toContain("last_owner");
    const { data } = await serviceClient().from("organization_members").select("status").eq("organization_id", fx.orgA).eq("user_id", fx.ids.ownerA).single();
    expect(data?.status).toBe("active"); // the failed attempt changed nothing
  });
});

describe("engagement overview", () => {
  it("a client gets their own company's overview, never another's", async () => {
    expect((await ownerA.rpc("org_overview", { p_org: fx.orgA })).data).not.toBeNull();
    expect((await ownerA.rpc("org_overview", { p_org: fx.orgB })).data).toBeNull();
    expect((await anonClient().rpc("org_overview", { p_org: fx.orgA })).error).not.toBeNull();
  });
});
