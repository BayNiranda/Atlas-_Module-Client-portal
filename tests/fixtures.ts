import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { totp } from "./totp";

// Invented test data only. Never real clients.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const USERS = {
  ownerA: { email: "cems-test-owner-a@example.com", name: "Test Owner A" },
  memberA: { email: "cems-test-member-a@example.com", name: "Test Member A" },
  ownerB: { email: "cems-test-owner-b@example.com", name: "Test Owner B" },
  staff: { email: "cems-test-staff@example.com", name: "Test Staff Admin" },
  consultant: { email: "cems-test-consultant@example.com", name: "Test Consultant" },
  superAdmin: { email: "cems-test-superadmin@example.com", name: "Test Super Admin" },
  convertClient: { email: "cems-test-convert-client@example.com", name: "Test Converted Client" },
  agreementOwner: { email: "cems-test-agreement-owner@example.com", name: "Test Agreement Owner" },
  agreementMember: { email: "cems-test-agreement-member@example.com", name: "Test Agreement Member" },
} as const;

// Staff test users and their roles (everyone else is a client or has no role).
const STAFF_ROLES: Partial<Record<keyof typeof USERS, string>> = {
  staff: "ADMIN", consultant: "CONSULTANT", superAdmin: "SUPER_ADMIN",
};
export type UserKey = keyof typeof USERS;

export const ORG_A = "Test Org A (fake)";
export const ORG_B = "Test Org B (fake)";

// Fresh random password each run, so no test credentials are stored anywhere.
const password = randomBytes(24).toString("base64url");

export function serviceClient() {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function signInAs(key: UserKey): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: USERS[key].email, password });
  if (error) throw new Error(`Sign-in failed for ${key}: ${error.message}`);
  return client;
}

// Staff session that has passed MFA (aal2).
export async function signInStaffWithMfa(key: UserKey = "staff"): Promise<SupabaseClient> {
  const client = await signInAs(key);
  // Remove factors from earlier sign-ins in this run (their secrets are gone).
  const userId = (await client.auth.getUser()).data.user!.id;
  const svc = serviceClient();
  const old = await svc.auth.admin.mfa.listFactors({ userId });
  for (const factor of old.data?.factors ?? []) await svc.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw enrolled.error;
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (error) throw error;
  return client;
}

export type Fixtures = { ids: Record<UserKey, string>; orgA: string; orgB: string };

export async function setupFixtures(): Promise<Fixtures> {
  if (!url || !publishableKey || !serviceKey) {
    throw new Error("Missing Supabase settings. Copy .env.example to .env.local and fill it in.");
  }
  // Safety: only the dev project. Production has a non-localhost site URL.
  if (!process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://localhost")) {
    throw new Error("Refusing to create test data: NEXT_PUBLIC_SITE_URL is not localhost.");
  }

  const admin = serviceClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const ids = {} as Record<UserKey, string>;
  for (const key of Object.keys(USERS) as UserKey[]) {
    const { email, name } = USERS[key];
    let id = list.users.find((u) => u.email === email)?.id;
    if (!id) {
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: name },
      });
      if (created.error) throw created.error;
      id = created.data.user.id;
    } else {
      const updated = await admin.auth.admin.updateUserById(id, { password });
      if (updated.error) throw updated.error;
    }
    ids[key] = id;
  }

  // Staff test users: their role, and no MFA factors left over from earlier runs.
  for (const [key, role] of Object.entries(STAFF_ROLES) as [UserKey, string][]) {
    await must(admin.from("profiles").update({ staff_role: role, is_active: true }).eq("id", ids[key]));
    const factors = await admin.auth.admin.mfa.listFactors({ userId: ids[key] });
    for (const f of factors.data?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: ids[key] });
    }
  }

  const orgA = await ensureOrg(admin, ORG_A);
  const orgB = await ensureOrg(admin, ORG_B);
  await must(
    admin.from("organization_members").upsert(
      [
        { organization_id: orgA, user_id: ids.ownerA, role: "CLIENT_OWNER", status: "active" },
        { organization_id: orgA, user_id: ids.memberA, role: "CLIENT_MEMBER", status: "active" },
        { organization_id: orgB, user_id: ids.ownerB, role: "CLIENT_OWNER", status: "active" },
      ],
      { onConflict: "organization_id,user_id" },
    ),
  );
  return { ids, orgA, orgB };
}

async function ensureOrg(admin: SupabaseClient, name: string): Promise<string> {
  const { data } = await admin.from("organizations").select("id").eq("name", name).maybeSingle();
  if (data) return data.id;
  const inserted = await admin.from("organizations").insert({ name }).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function must<T extends { error: unknown }>(p: PromiseLike<T>): Promise<T> {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}

// Tests that submit web inquiries notify all managers, including the real owner
// account. Remove those, and anything sent to test users, after each test file.
export async function cleanupTestNotifications(ids?: Partial<Record<UserKey, string>>) {
  const svc = serviceClient();
  await svc.from("notifications").delete().like("body", "%(automated test)%");
  const userIds = Object.values(ids ?? {}).filter(Boolean) as string[];
  if (userIds.length) await svc.from("notifications").delete().in("user_id", userIds);
}

// Pre-assessment of a test company back to "not started" (status first: approved answers are locked).
export async function resetAssessment(orgId: string) {
  const svc = serviceClient();
  await svc.from("assessments").update({ status: "not_started" }).eq("organization_id", orgId);
  await svc.from("assessments").update({ answers: {}, submitted_at: null, submitted_by: null, reviewed_at: null, reviewed_by: null, review_comment: null }).eq("organization_id", orgId);
}

// Agreements can never be deleted once issued (by design), so agreement tests
// use one permanent fake company and leave their records in the dev database.
export const AGREEMENT_ORG = "Agreement Test Co. (automated test)";
export async function agreementOrg(ids: Record<UserKey, string>) {
  const svc = serviceClient();
  let { data } = await svc.from("organizations").select("id").eq("name", AGREEMENT_ORG).maybeSingle();
  if (!data) data = (await svc.from("organizations").insert({ name: AGREEMENT_ORG, status: "active" }).select("id").single()).data!;
  await must(svc.from("organization_members").upsert([
    { organization_id: data.id, user_id: ids.agreementOwner, role: "CLIENT_OWNER", status: "active" },
    { organization_id: data.id, user_id: ids.agreementMember, role: "CLIENT_MEMBER", status: "active" },
  ], { onConflict: "organization_id,user_id" }));
  return data.id as string;
}
