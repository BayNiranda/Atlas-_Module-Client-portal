import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, roleLabel } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

const LIMIT = 200;
const TYPES = [
  ["inquiries", "Inquiries"], ["organizations", "Companies"], ["organization_members", "Portal users"], ["profiles", "Staff and sign-ins"],
  ["proposals", "Proposals"], ["assessments", "Pre-assessments"], ["agreements", "Agreements"], ["documents", "Documents"],
  ["document_requests", "Document requests"], ["projects", "Projects"], ["tasks", "Tasks"], ["service_requests", "Client requests"],
] as const;
const typeLabel = (t: string) => TYPES.find(([k]) => k === t)?.[1] ?? t;

// Where a log line can link to in the admin area.
const LINKS: Record<string, string> = {
  inquiries: "/admin/inquiries/", organizations: "/admin/clients/", proposals: "/admin/proposals/",
  assessments: "/admin/assessments/", agreements: "/admin/agreements/", projects: "/admin/projects/",
};

const ACTIONS: Record<string, string> = {
  insert: "created", update: "changed", download: "downloaded", sign_in: "signed in", access_change: "access changed",
};
const pretty = (s: string | null) => (s ?? "").replaceAll("_", " ");

type Row = {
  id: number; occurred_at: string; actor_id: string | null; actor_role: string | null; organization_id: string | null;
  entity_type: string; entity_id: string | null; action: string; from_status: string | null; to_status: string | null;
  metadata: Record<string, unknown>;
};

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : "");
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireStaff(["SUPER_ADMIN", "ADMIN"]);
  const sp = await searchParams;
  const f = {
    org: uuid(sp.org), person: uuid(sp.person),
    type: TYPES.some(([k]) => k === sp.type) ? String(sp.type) : "",
    from: day(sp.from), to: day(sp.to),
  };

  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*").order("occurred_at", { ascending: false }).limit(LIMIT);
  if (f.org) q = q.eq("organization_id", f.org);
  if (f.person) q = q.eq("actor_id", f.person);
  if (f.type) q = q.eq("entity_type", f.type);
  // Dates are Laos days (UTC+7).
  if (f.from) q = q.gte("occurred_at", `${f.from}T00:00:00+07:00`);
  if (f.to) q = q.lte("occurred_at", `${f.to}T23:59:59.999+07:00`);

  const [{ data, error }, { data: orgs }, { data: people }] = await Promise.all([
    q,
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email, staff_role").order("full_name"),
  ]);
  if (error) throw error;
  const rows = data as Row[];
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const person = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email || "—"]));

  return (
    <>
      <div className="top">
        <div>
          <h1>Activity log</h1>
          <div className="sub">Who did what, and when. Entries can never be changed or deleted. Showing the latest {LIMIT} that match.</div>
        </div>
      </div>

      <form className="panel" method="get" style={{ maxWidth: 1100 }}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="org">Company</label>
            <select id="org" name="org" defaultValue={f.org}>
              <option value="">All</option>
              {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="person">Person</label>
            <select id="person" name="person" defaultValue={f.person}>
              <option value="">Everyone</option>
              {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}{p.staff_role ? ` (${roleLabel(p.staff_role)})` : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue={f.type}>
              <option value="">All</option>
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={f.from} />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={f.to} />
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-p" type="submit">Filter</button>
          <Link className="btn btn-o" href="/admin/activity">Clear</Link>
        </div>
      </form>

      <div className="tbl">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Company</th><th>What</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const link = r.entity_id && LINKS[r.entity_type] ? LINKS[r.entity_type] + r.entity_id : null;
              const what = `${typeLabel(r.entity_type)} ${ACTIONS[r.action] ?? pretty(r.action)}`;
              return (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.occurred_at)}</td>
                  <td>
                    {r.actor_id ? person.get(r.actor_id) ?? "Unknown user" : "System"}
                    <small>{r.actor_role === "client" ? "Client" : r.actor_role === "system" ? "" : roleLabel(r.actor_role)}</small>
                  </td>
                  <td>{r.organization_id ? orgName.get(r.organization_id) ?? "—" : "—"}</td>
                  <td>
                    {link ? <Link href={link}>{what}</Link> : what}
                    {r.to_status && <small>{r.from_status ? `${pretty(r.from_status)} → ` : ""}{pretty(r.to_status)}</small>}
                    {typeof r.metadata?.kind === "string" && <small>{pretty(r.metadata.kind)} file</small>}
                    {r.action === "access_change" && (
                      <small>
                        {roleLabel(r.metadata.from_role as string | null)} → {roleLabel(r.metadata.to_role as string | null)}
                        {r.metadata.from_active !== r.metadata.to_active && (r.metadata.to_active ? " · activated" : " · deactivated")}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={4} className="muted">Nothing matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
