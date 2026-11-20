import { describe, expect, it } from "vitest";
import { parseInquiryForm } from "@/modules/inquiries/schema";
import { vatSplit } from "@/app/(public)/_components/vat-calculator";

function form(overrides: Record<string, string | string[] | null> = {}) {
  const base: Record<string, string | string[] | null> = {
    company_name: "Fake Trading Co.", contact_name: "Test Person", email: "test@example.com",
    phone: "+856 20 1234 5678", industry: "Retail", company_size: "", services: ["accounting"],
    challenge: "Our books are behind by six months.", preferred_date: "", consent: "on",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v === null) continue;
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return parseInquiryForm(fd);
}
const errorsOf = (r: ReturnType<typeof form>) => (r.success ? [] : r.error.issues.map((i) => i.path[0]));

describe("inquiry form rules", () => {
  it("accepts a complete form", () => {
    expect(form().success).toBe(true);
  });
  it("requires consent", () => {
    expect(errorsOf(form({ consent: null }))).toContain("consent");
  });
  it("requires at least one service and removes duplicates", () => {
    expect(errorsOf(form({ services: [] }))).toContain("services");
    const r = form({ services: ["accounting", "accounting", "advisory"] });
    expect(r.success && r.data.services).toEqual(["accounting", "advisory"]);
  });
  it("rejects bad email, short phone, short challenge, unknown industry", () => {
    const e = errorsOf(form({ email: "nope", phone: "123", challenge: "short", industry: "Spaceships" }));
    expect(e).toEqual(expect.arrayContaining(["email", "phone", "challenge", "industry"]));
  });
  it("rejects oversized input", () => {
    expect(errorsOf(form({ challenge: "x".repeat(4001) }))).toContain("challenge");
  });
  it("rejects service values that are not simple slugs", () => {
    expect(errorsOf(form({ services: ["accounting'; drop table--"] }))).toContain("services");
  });
});

describe("VAT calculator", () => {
  it("adds 10% VAT", () => {
    expect(vatSplit(1_000_000, "add")).toEqual({ net: 1_000_000, vat: 100_000, gross: 1_100_000 });
  });
  it("removes VAT from a VAT-inclusive amount", () => {
    const r = vatSplit(1_100_000, "remove");
    expect(Math.round(r.net)).toBe(1_000_000);
    expect(Math.round(r.vat)).toBe(100_000);
  });
});
