import { describe, expect, it } from "vitest";
import { checkUpload, detectFileType, MAX_FILE_BYTES, safeDisplayName } from "@/modules/agreements/files";
import { buildContent, durationMonths, longDate } from "@/modules/agreements/content";
import { fill, STANDARD_ARTICLES } from "@/modules/agreements/template";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("uploaded file checks", () => {
  it("recognises PDF, JPG and PNG from their first bytes", () => {
    expect(detectFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.ext).toBe("pdf");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff))?.ext).toBe("jpg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
  });
  it("refuses other files, even with a PDF name", () => {
    expect(checkUpload(100, bytes(0x4d, 0x5a))).toEqual({ ok: false, error: "Only PDF, JPG or PNG files are accepted." }); // a Windows program
  });
  it("refuses empty and oversized files", () => {
    expect(checkUpload(0, bytes(0x25, 0x50, 0x44, 0x46, 0x2d)).ok).toBe(false);
    expect(checkUpload(MAX_FILE_BYTES + 1, bytes(0x25, 0x50, 0x44, 0x46, 0x2d)).ok).toBe(false);
    expect(checkUpload(MAX_FILE_BYTES, bytes(0x25, 0x50, 0x44, 0x46, 0x2d)).ok).toBe(true);
  });
  it("cleans file names for display", () => {
    expect(safeDisplayName("../../etc/passwd<script>.pdf")).not.toMatch(/[/<>]/);
  });
});

describe("agreement content", () => {
  it("writes dates in English and Lao", () => {
    expect(longDate("2026-06-01", "en")).toBe("01 June 2026");
    expect(longDate("2026-12-31", "lo")).toBe("31 ທັນວາ 2026");
  });
  it("counts the contract duration in months", () => {
    expect(durationMonths("2026-06-01", "2026-12-31")).toBe(7);
    expect(durationMonths("2026-01-15", "2026-07-14")).toBe(6);
    expect(durationMonths("2026-06-01", "2026-06-15")).toBe(1);
    expect(durationMonths("2026-01-01", "2026-12-31")).toBe(12);
  });
  it("copies scope and fees from the proposal and includes Articles 5 to 16", () => {
    const c = buildContent({
      clientName: "Fake Co.", proposalRef: "PRO-2611-0001 v1", currency: "USD", paymentTerms: "50% on signing",
      items: [{ title: "Set-up", deliverables: "Chart of accounts", billing: "fixed", amount: 1500 }],
    });
    expect(c.items).toEqual([{ title: "Set-up", title_lo: "", deliverables: "Chart of accounts", billing: "fixed", amount: 1500 }]);
    expect(c.payment_terms.en).toBe("50% on signing");
    expect(c.articles.map((a) => a.no)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });
  it("fills fields, and leaves unknown ones visible", () => {
    const term = STANDARD_ARTICLES.find((a) => a.no === 9)!.paragraphs![0].en;
    expect(fill(term, { start: "01 June 2026", end: "31 December 2026" })).toContain("commence on 01 June 2026 and continue until 31 December 2026");
    expect(fill("{{nope}}", {})).toBe("{{nope}}");
  });
  it("contains no client-specific wording from the source agreement", () => {
    const all = JSON.stringify(STANDARD_ARTICLES);
    expect(all).not.toMatch(/LDC|Dental|ATLAS-Q|USD \d/);
  });
});
