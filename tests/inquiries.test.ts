import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, cleanupTestNotifications } from "./fixtures";

// Module 1: services are public; inquiries are staff-only and can only be
// created through submit_inquiry(), which only the server may call.
const testIp = `test-${randomUUID()}`; // fake ip_hash, unique per run
const created: string[] = [];

function args(overrides: Record<string, unknown> = {}) {
  return {
    p_company_name: "Fake Test Co. (automated test)", p_contact_name: "Test Person",
    p_email: "cems-test-inquiry@example.com", p_phone: "+856 20 0000 0000", p_industry: "Retail",
    p_company_size: "", p_challenge: "Automated test inquiry, please ignore.", p_preferred_date: null,
    p_service_slugs: ["accounting", "advisory"], p_ip_hash: testIp, ...overrides,
  };
}

beforeAll(async () => {
  await setupFixtures();
});

afterAll(async () => {
  await cleanupTestNotifications(undefined);
  if (created.length) await serviceClient().from("inquiries").delete().in("reference", created);
});

describe("services", () => {
  it("a logged-out visitor sees the 4 published services", async () => {
    const { data, error } = await anonClient().from("services").select("slug").order("sort_order");
    expect(error).toBeNull();
    expect(data?.map((s) => s.slug)).toEqual(["accounting", "advisory", "startup", "improvement"]);
  });

  it("a visitor or client cannot change services", async () => {
    await anonClient().from("services").update({ name: "HACKED" }).eq("slug", "accounting");
    const ownerA = await signInAs("ownerA");
    await ownerA.from("services").update({ name: "HACKED" }).eq("slug", "accounting");
    const { data } = await serviceClient().from("services").select("name").eq("slug", "accounting").single();
    expect(data?.name).toBe("Accounting Services");
  });
});

describe("submitting an inquiry", () => {
  it("the server can submit, and gets a reference number", async () => {
    const { data, error } = await serviceClient().rpc("submit_inquiry", args());
    expect(error).toBeNull();
    expect(data).toMatch(/^INQ-\d{4}-\d{4}$/);
    created.push(data as string);

    const { data: row } = await serviceClient()
      .from("inquiries").select("id, status, consent_at, inquiry_services(service_id)").eq("reference", data).single();
    expect(row?.status).toBe("new");
    expect(row?.consent_at).not.toBeNull();
    expect(row?.inquiry_services).toHaveLength(2);
  });

  it("a visitor cannot call it or insert directly", async () => {
    const anon = anonClient();
    expect((await anon.rpc("submit_inquiry", args())).error).not.toBeNull();
    const { error } = await anon.from("inquiries").insert({
      company_name: "x", contact_name: "x", email: "x@example.com", phone: "12345678",
      industry: "Retail", challenge: "direct insert attempt", consent_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("a logged-in client cannot call it either", async () => {
    const ownerA = await signInAs("ownerA");
    expect((await ownerA.rpc("submit_inquiry", args())).error).not.toBeNull();
  });

  it("rejects unknown services and saves nothing", async () => {
    const { error } = await serviceClient().rpc("submit_inquiry", args({ p_service_slugs: ["accounting", "nope"], p_ip_hash: `x-${randomUUID()}` }));
    expect(error?.message).toContain("invalid_service");
  });

  it("refuses the 6th inquiry from the same connection within an hour", async () => {
    // One already sent above with testIp; send 4 more, then the 6th must fail.
    for (let i = 0; i < 4; i++) {
      const { data, error } = await serviceClient().rpc("submit_inquiry", args());
      expect(error).toBeNull();
      created.push(data as string);
    }
    const { error } = await serviceClient().rpc("submit_inquiry", args());
    expect(error?.message).toContain("rate_limited");
  });
});

describe("reading inquiries", () => {
  it("a visitor and a client see none", async () => {
    expect((await anonClient().from("inquiries").select("id")).data ?? []).toHaveLength(0);
    const ownerA = await signInAs("ownerA");
    expect((await ownerA.from("inquiries").select("id")).data ?? []).toHaveLength(0);
    expect((await ownerA.from("inquiry_services").select("inquiry_id")).data ?? []).toHaveLength(0);
  });

  it("staff without MFA see none", async () => {
    const staff = await signInAs("staff");
    expect((await staff.from("inquiries").select("id")).data ?? []).toHaveLength(0);
  });

  it("staff with MFA can read them", async () => {
    const staff = await signInStaffWithMfa();
    const { data } = await staff.from("inquiries").select("reference").in("reference", created);
    expect(data?.length).toBe(created.length);
  });
});
