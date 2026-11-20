import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agreementOrg, anonClient, cleanupTestNotifications, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 6: agreements signed by scan. Agreements cannot be deleted once
// issued (by design), so these records stay under one permanent fake company.
let fx: Fixtures;
let org: string;
let admin: SupabaseClient;
let consultant: SupabaseClient;
let owner: SupabaseClient;
let member: SupabaseClient;
let proposalId: string;
let v1: string;
let v2: string;

const T = "(automated test)";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane" }).format(new Date());
const statusOf = async (id: string) => (await serviceClient().from("agreements").select("status").eq("id", id).single()).data?.status;
const content = { template_version: 1, client_name: "Agreement Test Co.", items: [], articles: [] };

beforeAll(async () => {
  fx = await setupFixtures();
  org = await agreementOrg(fx.ids);
  admin = await signInStaffWithMfa("staff");
  consultant = await signInStaffWithMfa("consultant");
  owner = await signInAs("agreementOwner");
  member = await signInAs("agreementMember");

  // An accepted proposal to build from (approve the pre-assessment, send, accept).
  await serviceClient().from("assessments").update({ status: "approved" }).eq("organization_id", org);
  const { data: p } = await admin.from("proposals")
    .insert({ organization_id: org, title: `Agreement source ${T}`, currency: "USD", valid_until: today(), created_by: fx.ids.staff })
    .select("id").single();
  proposalId = p!.id;
  await admin.rpc("replace_proposal_items", { p_id: proposalId, p_items: [{ service_id: "", title: "Set-up", scope: "", deliverables: "", billing: "fixed", amount: 1500 }] });
  expect((await admin.rpc("send_proposal", { p_id: proposalId })).error).toBeNull();
  expect((await owner.rpc("respond_to_proposal", { p_id: proposalId, p_accept: true })).error).toBeNull();
});

afterAll(async () => {
  await cleanupTestNotifications(fx.ids);
  await serviceClient().from("notifications").delete().like("body", `%Agreement Test Co.%`);
  // Signing creates projects, which notifies every manager (owner included).
  await serviceClient().from("notifications").delete().like("title", "New projects: Agreement Test Co.%");
});

describe("preparing", () => {
  it("only from an accepted proposal", async () => {
    const { data: draftProp } = await admin.from("proposals")
      .insert({ organization_id: org, title: `Not accepted ${T}`, currency: "USD", valid_until: today(), created_by: fx.ids.staff }).select("id").single();
    const { error } = await consultant.rpc("prepare_agreement", { p_proposal: draftProp!.id, p_title: "x", p_start: today(), p_end: today(), p_content: content });
    expect(error?.message).toContain("proposal_not_accepted");
    await admin.from("proposals").delete().eq("id", draftProp!.id);
  });

  it("any staff member prepares a draft; preparing again reuses it", async () => {
    const args = { p_proposal: proposalId, p_title: `Service Agreement ${T}`, p_start: "2026-06-01", p_end: "2026-12-31", p_content: content };
    const first = await consultant.rpc("prepare_agreement", args);
    expect(first.error).toBeNull();
    v1 = first.data as string;
    expect((await consultant.rpc("prepare_agreement", args)).data).toBe(v1);
  });

  it("clients never see drafts, and nobody can insert directly", async () => {
    expect(((await owner.from("agreements").select("id").eq("id", v1)).data ?? [])).toHaveLength(0);
    const { error } = await admin.from("agreements").insert({ organization_id: org, proposal_id: proposalId, title: "x", start_date: today(), end_date: today(), content });
    expect(error).not.toBeNull();
  });
});

describe("issuing", () => {
  it("a consultant cannot issue; an admin can, and the client is told", async () => {
    expect((await consultant.rpc("issue_agreement", { p_id: v1 })).error?.message).toContain("not_allowed");
    expect((await admin.rpc("issue_agreement", { p_id: v1 })).error).toBeNull();
    expect(await statusOf(v1)).toBe("issued");
    const { data } = await serviceClient().from("notifications").select("user_id").eq("link", `/portal/agreements/${v1}`);
    expect(data?.map((n) => n.user_id)).toEqual(expect.arrayContaining([fx.ids.agreementOwner, fx.ids.agreementMember]));
  });

  it("once issued, the text is locked for everyone", async () => {
    await admin.from("agreements").update({ title: "CHANGED" }).eq("id", v1);
    expect((await serviceClient().from("agreements").select("title").eq("id", v1).single()).data?.title).not.toBe("CHANGED");
    expect((await serviceClient().from("agreements").update({ content: {} }).eq("id", v1)).error?.message).toContain("agreement_locked");
  });

  it("the company sees it; other companies and visitors do not", async () => {
    expect(((await member.from("agreements").select("id").eq("id", v1)).data ?? [])).toHaveLength(1);
    const ownerB = await signInAs("ownerB");
    expect(((await ownerB.from("agreements").select("id").eq("id", v1)).data ?? [])).toHaveLength(0);
    expect(((await anonClient().from("agreements").select("id")).data ?? [])).toHaveLength(0);
  });
});

describe("uploading signed copies", () => {
  it("a member cannot record the client-signed copy; the path must be this agreement's folder", async () => {
    const good = `${org}/${v1}/client-test.pdf`;
    expect((await member.rpc("record_agreement_file", { p_id: v1, p_kind: "client", p_path: good, p_name: "x.pdf", p_sha256: sha("a") })).error?.message).toContain("not_allowed");
    expect((await owner.rpc("record_agreement_file", { p_id: v1, p_kind: "client", p_path: `${org}/other/x.pdf`, p_name: "x.pdf", p_sha256: sha("a") })).error?.message).toContain("bad_path");
  });

  it("the owner records it once; it can never be replaced", async () => {
    const path = `${org}/${v1}/client-test.pdf`;
    expect((await owner.rpc("record_agreement_file", { p_id: v1, p_kind: "client", p_path: path, p_name: "signed.pdf", p_sha256: sha("client") })).error).toBeNull();
    expect(await statusOf(v1)).toBe("client_signed");
    expect((await owner.rpc("record_agreement_file", { p_id: v1, p_kind: "client", p_path: path, p_name: "again.pdf", p_sha256: sha("x") })).error?.message).toContain("not_open");
    expect((await serviceClient().from("agreements").update({ client_file_sha256: sha("tampered") }).eq("id", v1)).error?.message).toContain("agreement_file_locked");
  });

  it("only staff record the fully signed copy", async () => {
    expect((await owner.rpc("record_agreement_file", { p_id: v1, p_kind: "signed", p_path: `${org}/${v1}/signed-test.pdf`, p_name: "x.pdf", p_sha256: sha("b") })).error?.message).toContain("not_allowed");
  });
});

describe("confirming signed", () => {
  it("not before the fully signed copy exists, and not by a consultant", async () => {
    expect((await admin.rpc("confirm_agreement_signed", { p_id: v1 })).error?.message).toContain("signed_file_missing");
    await consultant.rpc("record_agreement_file", { p_id: v1, p_kind: "signed", p_path: `${org}/${v1}/signed-test.pdf`, p_name: "both.pdf", p_sha256: sha("both") });
    expect((await consultant.rpc("confirm_agreement_signed", { p_id: v1 })).error?.message).toContain("not_allowed");
  });

  it("an admin confirms; then it can never be changed, cancelled or deleted", async () => {
    expect((await admin.rpc("confirm_agreement_signed", { p_id: v1 })).error).toBeNull();
    expect(await statusOf(v1)).toBe("signed");
    expect((await admin.rpc("void_agreement", { p_id: v1, p_reason: "test" })).error?.message).toContain("not_open");
    expect((await serviceClient().from("agreements").update({ status: "voided" }).eq("id", v1)).error?.message).toContain("agreement_locked");
    expect((await serviceClient().from("agreements").delete().eq("id", v1)).error?.message).toContain("agreement_locked");
  });
});

describe("amendments and cancelling", () => {
  it("an amendment is a new version; confirming it supersedes the old one", async () => {
    v2 = (await consultant.rpc("new_agreement_version", { p_id: v1 })).data as string;
    const { data } = await serviceClient().from("agreements").select("version, status, supersedes_id").eq("id", v2).single();
    expect(data).toMatchObject({ status: "draft", supersedes_id: v1 });
    await admin.rpc("issue_agreement", { p_id: v2 });
    await admin.rpc("record_agreement_file", { p_id: v2, p_kind: "signed", p_path: `${org}/${v2}/signed-test.pdf`, p_name: "v2.pdf", p_sha256: sha("v2") });
    expect((await admin.rpc("confirm_agreement_signed", { p_id: v2 })).error).toBeNull();
    expect(await statusOf(v1)).toBe("superseded");
  });

  it("cancelling needs a reason the client will see", async () => {
    const v3 = (await admin.rpc("new_agreement_version", { p_id: v2 })).data as string;
    await admin.rpc("issue_agreement", { p_id: v3 });
    expect((await admin.rpc("void_agreement", { p_id: v3, p_reason: " " })).error?.message).toContain("reason_required");
    expect((await admin.rpc("void_agreement", { p_id: v3, p_reason: "Wrong period, corrected version follows." })).error).toBeNull();
    expect(await statusOf(v3)).toBe("voided");
  });
});

describe("private file storage", () => {
  it("clients and visitors cannot read stored files directly, only the server can", async () => {
    const path = `${org}/${v1}/storage-privacy-test.pdf`;
    const svc = serviceClient().storage.from("agreements");
    expect((await svc.upload(path, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), { contentType: "application/pdf", upsert: true })).error).toBeNull();
    expect((await owner.storage.from("agreements").createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await owner.storage.from("agreements").download(path)).error).not.toBeNull();
    expect((await anonClient().storage.from("agreements").download(path)).error).not.toBeNull();
    expect((await owner.storage.from("agreements").upload(`${org}/${v1}/sneaky.pdf`, new Uint8Array([1]))).error).not.toBeNull();
    await svc.remove([path]);
  });
});
