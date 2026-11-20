// Checks for uploaded files. Pure: used by the server and tests.
// The type is decided from the file's content, never from its name
// (the name only matters for CSV, which is plain text).

export type FileKind = "pdf" | "jpg" | "png" | "xlsx" | "docx" | "xls" | "csv";

export const KINDS: Record<FileKind, { type: string; ext: string }> = {
  pdf: { type: "application/pdf", ext: "pdf" },
  jpg: { type: "image/jpeg", ext: "jpg" },
  png: { type: "image/png", ext: "png" },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  xls: { type: "application/vnd.ms-excel", ext: "xls" },
  csv: { type: "text/csv", ext: "csv" },
};

export const AGREEMENT_KINDS: FileKind[] = ["pdf", "jpg", "png"];
export const DOCUMENT_KINDS: FileKind[] = ["pdf", "jpg", "png", "xlsx", "docx", "xls", "csv"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // agreements
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // documents

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

function contains(b: Uint8Array, text: string, utf16 = false) {
  const needle = utf16 ? [...text].flatMap((c) => [c.charCodeAt(0), 0]) : [...text].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= b.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

// Returns the detected kind, "macro" for Office files with macros, or null.
export function detectKind(b: Uint8Array, name = ""): FileKind | "macro" | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // Office files are ZIP packages; file names inside are stored as plain text.
    if (!contains(b, "[Content_Types].xml")) return null;
    if (contains(b, "vbaProject.bin")) return "macro";
    if (contains(b, "xl/")) return "xlsx";
    if (contains(b, "word/")) return "docx";
    return null;
  }
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    // Old Office format: only Excel workbooks, never with macros.
    if (contains(b, "_VBA_PROJECT", true) || contains(b, "_VBA_PROJECT")) return "macro";
    return contains(b, "Workbook", true) || contains(b, "Book", true) ? "xls" : null;
  }
  if (/\.csv$/i.test(name) && !b.subarray(0, 65536).includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, 65536));
      return "csv";
    } catch {
      return null;
    }
  }
  return null;
}

export function checkFile(bytes: Uint8Array, name: string, allowed: FileKind[], maxBytes: number):
  { ok: true; kind: FileKind; type: string; ext: string } | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "Choose a file to upload." };
  if (bytes.byteLength > maxBytes) return { ok: false, error: `The file is larger than ${maxBytes / 1024 / 1024} MB.` };
  const kind = detectKind(bytes, name);
  if (kind === "macro") return { ok: false, error: "Files with macros are not accepted. Save it as a normal .xlsx or .docx." };
  if (!kind || !allowed.includes(kind)) {
    return { ok: false, error: `Only ${allowed.map((k) => KINDS[k].ext.toUpperCase()).join(", ")} files are accepted.` };
  }
  return { ok: true, kind, ...KINDS[kind] };
}

// Keep a readable original name for display only (never used as a storage path).
export function safeDisplayName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 120) || "file";
}
