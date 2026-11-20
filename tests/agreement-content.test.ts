import { describe, expect, it } from "vitest";
import { AGREEMENT_KINDS, checkFile, detectKind, DOCUMENT_KINDS, MAX_DOCUMENT_BYTES, MAX_FILE_BYTES, safeDisplayName } from "@/modules/agreements/files";
import { buildContent, durationMonths, longDate } from "@/modules/agreements/content";
import { fill, STANDARD_ARTICLES } from "@/modules/agreements/template";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = (s: string) => new TextEncoder().encode(s);

describe("uploaded file checks", () => {
  const pdf = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);
  it("recognises PDF, JPG and PNG from their first bytes", () => {
    expect(detectKind(pdf)).toBe("pdf");
    expect(detectKind(bytes(0xff, 0xd8, 0xff))).toBe("jpg");
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
  });
  it("refuses other files, even with a PDF name", () => {
    expect(checkFile(bytes(0x4d, 0x5a), "invoice.pdf", AGREEMENT_KINDS, MAX_FILE_BYTES)).toMatchObject({ ok: false }); // a Windows program
  });
  it("refuses empty and oversized files", () => {
    expect(checkFile(new Uint8Array(), "a.pdf", AGREEMENT_KINDS, MAX_FILE_BYTES).ok).toBe(false);
    const big = new Uint8Array(MAX_FILE_BYTES + 1); big.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(checkFile(big, "a.pdf", AGREEMENT_KINDS, MAX_FILE_BYTES).ok).toBe(false);
    expect(checkFile(big.subarray(0, MAX_FILE_BYTES), "a.pdf", AGREEMENT_KINDS, MAX_FILE_BYTES).ok).toBe(true);
  });
  it("only accepts the kinds allowed for the place it is uploaded", () => {
    expect(checkFile(text("a,b\n1,2"), "data.csv", AGREEMENT_KINDS, MAX_FILE_BYTES).ok).toBe(false);
    expect(checkFile(text("a,b\n1,2"), "data.csv", DOCUMENT_KINDS, MAX_DOCUMENT_BYTES)).toMatchObject({ ok: true, kind: "csv" });
  });
  it("recognises Excel and Word, and refuses files with macros", () => {
    const zip = (...names: string[]) => new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...text(names.join("|"))]);
    expect(detectKind(zip("[Content_Types].xml", "xl/workbook.xml"))).toBe("xlsx");
    expect(detectKind(zip("[Content_Types].xml", "word/document.xml"))).toBe("docx");
    expect(detectKind(zip("[Content_Types].xml", "xl/workbook.xml", "xl/vbaProject.bin"))).toBe("macro");
    expect(checkFile(zip("[Content_Types].xml", "xl/vbaProject.bin"), "x.xlsm", DOCUMENT_KINDS, MAX_DOCUMENT_BYTES)).toMatchObject({ ok: false });
    expect(detectKind(zip("random.txt"))).toBeNull(); // a plain zip
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const u16 = (s: string) => [...s].flatMap((ch) => [ch.charCodeAt(0), 0]);
    expect(detectKind(new Uint8Array([...ole, ...u16("Workbook")]))).toBe("xls");
    expect(detectKind(new Uint8Array([...ole, ...u16("Workbook"), ...u16("_VBA_PROJECT")]))).toBe("macro");
  });
  it("only treats valid text as CSV", () => {
    expect(detectKind(new Uint8Array([0x61, 0x00, 0x62]), "x.csv")).toBeNull();
    expect(detectKind(text("a,b"), "x.txt")).toBeNull();
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
