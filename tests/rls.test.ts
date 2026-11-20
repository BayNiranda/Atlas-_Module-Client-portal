import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Proves the database itself (RLS) keeps organizations apart, whatever the app code does.
let fx: Fixtures;
let ownerA: SupabaseClient;

beforeAll(async () => {
  fx = await setupFixtures();
  ownerA = await signInAs("ownerA");
});

const rows = <T,>(r: { data: T[] | null }) => r.data ?? [];

describe("logged-out visitor", () => {
  it("cannot read any table", async () => {
    const anon = anonClient();
    for (const table of ["profiles", "organizations", "organization_members", "audit_log"]) {
      expect(rows(await anon.from(table).select("*")), table).toHaveLength(0);
    }
  });
});

describe("client of Org A", () => {
  it("sees only Org A", async () => {
    const orgs = rows(await ownerA.from("organizations").select("id"));
    expect(orgs.map((o) => o.id)).toEqual([fx.orgA]);
  });

  it("cannot read Org B even by id", async () => {
    expect(rows(await ownerA.from("organizations").select("id").eq("id", fx.orgB))).toHaveLength(0);
    expect(rows(await ownerA.from("organization_members").select("id").eq("organization_id", fx.orgB))).toHaveLength(0);
  });

  it("sees only Org A members", async () => {
    const members = rows(await ownerA.from("organization_members").select("organization_id"));
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((m) => m.organization_id === fx.orgA)).toBe(true);
  });

  it("sees their own profile and Org A colleagues only, never Org B people", async () => {
    // Module 3 rule: clients may see the names of people in their own company.
    const ids = rows(await ownerA.from("profiles").select("id")).map((p) => p.id);
    expect(ids).toContain(fx.ids.ownerA);
    expect(ids.every((id) => id === fx.ids.ownerA || id === fx.ids.memberA)).toBe(true);
    expect(ids).not.toContain(fx.ids.ownerB);
  });

  it("cannot read the audit log", async () => {
    expect(rows(await ownerA.from("audit_log").select("id"))).toHaveLength(0);
  });

  it("cannot change Org B or their own org", async () => {
    for (const id of [fx.orgB, fx.orgA]) {
      await ownerA.from("organizations").update({ name: "HACKED" }).eq("id", id);
      const { data } = await serviceClient().from("organizations").select("name").eq("id", id).single();
      expect(data?.name).not.toBe("HACKED");
    }
  });

  it("cannot add themselves to Org B", async () => {
    const { error } = await ownerA.from("organization_members").insert({
      organization_id: fx.orgB, user_id: fx.ids.ownerA, role: "CLIENT_OWNER", status: "active",
    });
    expect(error).not.toBeNull();
  });

  it("cannot give themselves a staff role", async () => {
    const { error } = await ownerA.from("profiles").update({ staff_role: "SUPER_ADMIN" }).eq("id", fx.ids.ownerA);
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("profiles").select("staff_role").eq("id", fx.ids.ownerA).single();
    expect(data?.staff_role).toBeNull();
  });

  it("can update their own name", async () => {
    const { error } = await ownerA.from("profiles").update({ full_name: "Test Owner A" }).eq("id", fx.ids.ownerA);
    expect(error).toBeNull();
  });
});

describe("revoked member", () => {
  it("loses access immediately", async () => {
    const admin = serviceClient();
    await admin.from("organization_members").update({ status: "revoked" })
      .eq("organization_id", fx.orgA).eq("user_id", fx.ids.memberA);
    const memberA = await signInAs("memberA");
    expect(rows(await memberA.from("organizations").select("id"))).toHaveLength(0);
    // Fixtures re-activate this membership on the next run.
  });
});

describe("staff", () => {
  it("without MFA sees no client data", async () => {
    const staff = await signInAs("staff");
    expect(rows(await staff.from("organizations").select("id"))).toHaveLength(0);
  });

  it("with MFA sees all organizations and the audit log", async () => {
    const staff = await signInStaffWithMfa();
    const ids = rows(await staff.from("organizations").select("id")).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([fx.orgA, fx.orgB]));

    // A status change is logged automatically.
    const { data: before } = await staff.from("organizations").select("status").eq("id", fx.orgA).single();
    const next = before?.status === "active" ? "prospect" : "active";
    const { error } = await staff.from("organizations").update({ status: next }).eq("id", fx.orgA);
    expect(error).toBeNull();
    const log = rows(
      await staff.from("audit_log").select("to_status").eq("entity_id", fx.orgA)
        .order("id", { ascending: false }).limit(1),
    );
    expect(log[0]?.to_status).toBe(next);
  });
});

describe("audit log", () => {
  it("cannot be deleted, even with the service key", async () => {
    const { error } = await serviceClient().from("audit_log").delete().gt("id", 0);
    expect(error).not.toBeNull();
  });
});
