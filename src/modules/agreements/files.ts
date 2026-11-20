// Checks for uploaded agreement scans. Pure: used by the server and tests.
// The type is decided from the file's first bytes, never from its name.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; bytes: number[] }[] = [
  { type: "application/pdf", ext: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export function detectFileType(head: Uint8Array) {
  return SIGNATURES.find((s) => s.bytes.every((b, i) => head[i] === b)) ?? null;
}

export function checkUpload(size: number, head: Uint8Array): { ok: true; type: string; ext: string } | { ok: false; error: string } {
  if (size === 0) return { ok: false, error: "Choose a file to upload." };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 10 MB. Scan at a lower resolution or as PDF." };
  const kind = detectFileType(head);
  if (!kind) return { ok: false, error: "Only PDF, JPG or PNG files are accepted." };
  return { ok: true, type: kind.type, ext: kind.ext };
}

// Keep a readable original name for display only (never used as a storage path).
export function safeDisplayName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 120) || "file";
}
