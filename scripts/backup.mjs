// Weekly backup for the Free plan (which has no automatic backups).
// Saves every table, the list of logins and every stored file into
// backups/<date>/ on this computer. Contains real client data: keep it safe
// (the folder is never committed to GitHub).
//
// Run:  node --env-file=.env.production.local scripts/backup.mjs
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (pass --env-file=...)");

const s = createClient(url, key, { auth: { persistSession: false } });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const dir = join("backups", stamp);
mkdirSync(join(dir, "tables"), { recursive: true });

// 1. Every table, page by page.
const { data: tables, error } = await s.rpc("table_security");
if (error) throw error;
for (const { table_name } of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await s.from(table_name).select("*").range(from, from + 999);
    if (e) throw new Error(`${table_name}: ${e.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  writeFileSync(join(dir, "tables", `${table_name}.json`), JSON.stringify(rows, null, 1));
  console.log(`${table_name}: ${rows.length}`);
}

// 2. Logins (email, dates; never passwords).
const users = [];
for (let page = 1; ; page++) {
  const { data, error: e } = await s.auth.admin.listUsers({ page, perPage: 1000 });
  if (e) throw e;
  users.push(...data.users.map(({ id, email, created_at, last_sign_in_at, banned_until }) => ({ id, email, created_at, last_sign_in_at, banned_until })));
  if (data.users.length < 1000) break;
}
writeFileSync(join(dir, "logins.json"), JSON.stringify(users, null, 1));
console.log(`logins: ${users.length}`);

// 3. Files in the private buckets (folders are company ids).
async function walk(bucket, prefix) {
  const { data, error: e } = await s.storage.from(bucket).list(prefix, { limit: 1000 });
  if (e) throw e;
  let n = 0;
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) { n += await walk(bucket, path); continue; } // a folder
    const { data: blob, error: d } = await s.storage.from(bucket).download(path);
    if (d) throw new Error(`${bucket}/${path}: ${d.message}`);
    const out = join(dir, "files", bucket, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
    n++;
  }
  return n;
}
for (const bucket of ["agreements", "documents"]) console.log(`${bucket} files: ${await walk(bucket, "")}`);

console.log(`\nBackup saved in ${dir}`);
