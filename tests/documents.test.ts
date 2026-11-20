import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agreementOrg, anonClient, cleanupTestNotifications, serviceClient, setupFixtures, signInAs, signInStaffWithMfa, type Fixtures,
} from "./fixtures";

// Module 7: documents. Documents cannot be deleted (by design), so they stay
// under the permanent fake company, which already has a signed agreement.
let fx: Fixtures;
let org: string; // has a signed agreement (from agreements.test.ts)
let admin: SupabaseClient;
let consultant: SupabaseClient;
let member: SupabaseClient;
let requestId: string;

const T = "(automated test)";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const path = (o: string) => `${o}/${randomUUID()}`;
const record = (c: SupabaseClient, o: string, over: Record<string, unknown> = {}) =>
  c.rpc("record_document", {
    p_org: o, p_request: null, p_category: "bank_statements", p_visibility: "client", p_path: path(o),
    p_name: `statement ${T}.pdf`, p_mime: "application/pdf", p_size: 1234, p_sha256: sha(randomUUID()), ...over,
  });

beforeAll(async () => {
  fx = await setupFixtures();
  org = await agreementOrg(fx.ids);
  admin = await signInStaffWithMfa("staff");
  consultant = await signInStaffWithMfa("consultant");
  member = await signInAs("agreementMember");
  // Uploads need a signed agreement; agreements.test.ts leaves one on this company.
  const { count } = await serviceClient().from("agreements").select("id", { count: "exact", head: true }).eq("organization_id", org).in("status", ["signed", "superseded"]);
  expect(count, "agreement test company must have a signed agreement; run agreements.test.ts").toBeGreaterThan(0);
});

afterAll(async () => {
  await cleanupTestNotifications(fx.ids);
  await serviceClient().from("notifications").delete().like("title", "Document uploaded: Agreement Test Co.%");
});

describe("requests", () => {
  it("staff request a document and the client is told", async () => {
    const { data, error } = await consultant.rpc("request_document", { p_org: org, p_title: `Bank statements ${T}`, p_category: "bank_statements", p_note: "", p_due: null });
    expect(error).toBeNull();
    requestId = data as string;
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("type", "document_requested");
    expect(notes?.map((n) => n.user_id)).toContain(fx.ids.agreementMember);
  });

  it("clients cannot create requests or write anything directly", async () => {
    expect((await member.rpc("request_document", { p_org: org, p_title: "x", p_category: "other", p_note: "", p_due: null })).error?.message).toContain("not_allowed");
    expect((await member.from("documents").insert({ organization_id: org, file_name: "x", mime_type: "x", size_bytes: 1, sha256: sha("x"), storage_path: "x", uploaded_by: fx.ids.agreementMember })).error).not.toBeNull();
  });
});

describe("who may upload", () => {
  it("a client without a signed agreement cannot upload yet (owner's rule)", async () => {
    const ownerA = await signInAs("ownerA");
    expect((await ownerA.rpc("authorize_document_upload", { p_org: fx.orgA, p_request: null, p_visibility: "client" })).error?.message).toContain("no_signed_agreement");
  });

  it("a client with a signed agreement can; internal files and other companies are refused", async () => {
    expect((await member.rpc("authorize_document_upload", { p_org: org, p_request: requestId, p_visibility: "client" })).error).toBeNull();
    expect((await member.rpc("authorize_document_upload", { p_org: org, p_request: null, p_visibility: "internal" })).error?.message).toContain("not_allowed");
    const ownerB = await signInAs("ownerB");
    expect((await ownerB.rpc("authorize_document_upload", { p_org: org, p_request: null, p_visibility: "client" })).error?.message).toContain("not_allowed");
  });

  it("the file must sit in the company's own folder", async () => {
    expect((await record(member, org, { p_path: `${fx.orgB}/${randomUUID()}` })).error?.message).toContain("bad_path");
  });
});

describe("uploads and review", () => {
  let docId: string;
  let secondId: string;

  it("a client upload is recorded for review and Atlas is told", async () => {
    const { data, error } = await record(member, org, { p_request: requestId });
    expect(error).toBeNull();
    docId = data as string;
    expect((await serviceClient().from("documents").select("status").eq("id", docId).single()).data?.status).toBe("received");
    const { data: notes } = await serviceClient().from("notifications").select("user_id").eq("type", "document_uploaded");
    expect(notes?.map((n) => n.user_id)).toContain(fx.ids.staff);
  });

  it("clients cannot review; rejecting needs a reason the client sees", async () => {
    expect((await member.rpc("review_document", { p_id: docId, p_accept: true })).error?.message).toContain("not_allowed");
    expect((await consultant.rpc("review_document", { p_id: docId, p_accept: false })).error?.message).toContain("reason_required");
    expect((await consultant.rpc("review_document", { p_id: docId, p_accept: false, p_note: "Page 2 is missing." })).error).toBeNull();
    expect((await member.from("documents").select("status, review_note").eq("id", docId).single()).data).toEqual({ status: "rejected", review_note: "Page 2 is missing." });
    expect((await consultant.rpc("review_document", { p_id: docId, p_accept: true })).error?.message).toContain("already_reviewed");
  });

  it("accepting a replacement fulfils the request, which then closes", async () => {
    secondId = (await record(member, org, { p_request: requestId })).data as string;
    expect((await admin.rpc("review_document", { p_id: secondId, p_accept: true })).error).toBeNull();
    expect((await serviceClient().from("document_requests").select("status").eq("id", requestId).single()).data?.status).toBe("fulfilled");
    expect((await member.rpc("authorize_document_upload", { p_org: org, p_request: requestId, p_visibility: "client" })).error?.message).toContain("request_not_open");
  });

  it("a stored file record never changes and is never deleted", async () => {
    expect((await serviceClient().from("documents").update({ file_name: "swapped.pdf" }).eq("id", secondId)).error?.message).toContain("document_locked");
    expect((await serviceClient().from("documents").delete().eq("id", secondId)).error?.message).toContain("document_locked");
  });
});

describe("internal and shared files", () => {
  let internalId: string;

  it("staff files need no review; internal ones are invisible to clients", async () => {
    internalId = (await record(admin, org, { p_visibility: "internal", p_category: "other", p_name: `working paper ${T}.xlsx` })).data as string;
    const shared = (await record(admin, org, { p_category: "atlas_reports", p_name: `monthly report ${T}.pdf` })).data as string;
    const { data } = await serviceClient().from("documents").select("id, status").in("id", [internalId, shared]);
    expect(data?.every((d) => d.status === "accepted")).toBe(true);
    expect(((await member.from("documents").select("id").eq("id", internalId)).data ?? [])).toHaveLength(0);
    expect(((await member.from("documents").select("id").eq("id", shared)).data ?? [])).toHaveLength(1);
    expect(((await admin.from("documents").select("id").eq("id", internalId)).data ?? [])).toHaveLength(1);
  });

  it("downloads are logged, and only for files the person may see", async () => {
    const { data: visible } = await member.from("documents").select("id").eq("organization_id", org).eq("visibility", "client").limit(1).single();
    expect((await member.rpc("log_file_download", { p_entity: "documents", p_id: visible!.id })).error).toBeNull();
    const { data: log } = await serviceClient().from("audit_log").select("actor_id, action").eq("entity_id", visible!.id).eq("action", "download").order("id", { ascending: false }).limit(1).single();
    expect(log).toEqual({ actor_id: fx.ids.agreementMember, action: "download" });
    expect((await member.rpc("log_file_download", { p_entity: "documents", p_id: internalId })).error?.message).toContain("not_allowed");
    expect((await anonClient().rpc("log_file_download", { p_entity: "documents", p_id: internalId })).error).not.toBeNull();
  });
});

describe("private file storage", () => {
  it("a one-time upload permission works for its exact location only, and nobody reads storage directly", async () => {
    const target = `${org}/${randomUUID()}`;
    const { data: signed } = await serviceClient().storage.from("documents").createSignedUploadUrl(target);
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect((await member.storage.from("documents").uploadToSignedUrl(signed!.path, signed!.token, pdf, { contentType: "application/pdf" })).error).toBeNull();
    expect((await member.storage.from("documents").uploadToSignedUrl(`${org}/${randomUUID()}`, signed!.token, pdf, { contentType: "application/pdf" })).error).not.toBeNull();
    expect((await member.storage.from("documents").download(target)).error).not.toBeNull();
    expect((await anonClient().storage.from("documents").download(target)).error).not.toBeNull();
    expect((await member.storage.from("documents").upload(`${org}/${randomUUID()}`, pdf)).error).not.toBeNull();
    await serviceClient().storage.from("documents").remove([target]);
  });
});
