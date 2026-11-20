import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFile, type FileKind } from "@/modules/agreements/files";

// Uploads go straight from the browser to private storage (no size limit on
// our server), in two steps around the browser's upload:
//   1. uploadTarget(): after the caller's permission checks, a one-time
//      permission to write one exact, unguessable location.
//   2. inspectUpload(): the server reads the stored file back, checks its
//      real content and size, and fingerprints it. Bad files are deleted.

export async function uploadTarget(bucket: string, folder: string) {
  const path = `${folder}/${randomUUID()}`;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not prepare upload: ${error?.message}`);
  return { bucket, path: data.path, token: data.token };
}

export async function inspectUpload(bucket: string, path: string, name: string, allowed: FileKind[], maxBytes: number) {
  const storage = createAdminClient().storage.from(bucket);
  const { data, error } = await storage.download(path);
  if (error || !data) return { ok: false as const, error: "The upload did not arrive. Please try again." };
  const bytes = new Uint8Array(await data.arrayBuffer());
  const check = checkFile(bytes, name, allowed, maxBytes);
  if (!check.ok) {
    await storage.remove([path]);
    return check;
  }
  return { ...check, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function removeUpload(bucket: string, path: string) {
  await createAdminClient().storage.from(bucket).remove([path]);
}

// Only accept a path the server could have issued for this folder.
export const isIssuedPath = (path: string, folder: string) =>
  new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[0-9a-f-]{36}$`).test(path);
