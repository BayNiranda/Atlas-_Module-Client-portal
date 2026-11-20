import Link from "next/link";
import { MANAGERS, requireStaff } from "@/lib/auth/guards";
import { listInquiries, listStaff, personName } from "@/modules/inquiries/admin-queries";
import { fmtDate, STAGES } from "@/modules/inquiries/labels";
import { SourcePill, StagePill } from "../_components/pills";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function InquiriesPage({ searchParams }: PageProps<"/admin/inquiries">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";
  const stage = typeof sp.stage === "string" && STAGES.some(([k]) => k === sp.stage) ? sp.stage : undefined;
  const owner = typeof sp.owner === "string" && /^(unassigned|[0-9a-f-]{36})$/.test(sp.owner) ? sp.owner : undefined;
  const [rows, staff] = await Promise.all([listInquiries({ stage, owner }), listStaff()]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Inquiries and leads</h1>
          <div className="sub">WhatsApp chats and web forms land here. Order: discussion → consultation → pre-assessment → proposal → agreement.</div>
        </div>
        {MANAGERS.includes(user.staffRole) && <Link className="btn btn-p" href="/admin/inquiries/new">Log WhatsApp lead</Link>}
      </div>

      <div className="tabs">
        <Link href="/admin/inquiries" aria-current={view === "list" ? "page" : undefined}>List</Link>
        <Link href="/admin/inquiries?view=board" aria-current={view === "board" ? "page" : undefined}>Pipeline</Link>
        {view === "list" && (
          <form className="filters" method="get">
            <select name="stage" defaultValue={stage ?? ""} aria-label="Filter by stage">
              <option value="">All stages</option>
              {STAGES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select name="owner" defaultValue={owner ?? ""} aria-label="Filter by owner">
              <option value="">Any owner</option>
              <option value="unassigned">Unassigned</option>
              {staff.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{personName(s)}</option>)}
            </select>
            <button className="btn btn-o btn-sm" type="submit">Filter</button>
          </form>
        )}
      </div>

      {view === "board" ? (
        <div className="kanban">
          {STAGES.map(([k, label]) => {
            const items = rows.filter((r) => r.status === k);
            return (
              <div className="kcol" key={k}>
                <h4>{label}<span>{items.length}</span></h4>
                {items.map((i) => (
                  <Link className="kcard" key={i.id} href={`/admin/inquiries/${i.id}`}>
                    <b>{i.company_name}</b>
                    <small>{i.inquiry_services.map((s) => s.services?.code).filter(Boolean).join(" · ")} · {personName(i.assignee)}</small>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th>Reference</th><th>Company</th><th>Channel</th><th>Services</th><th>Received</th><th>Owner</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>{i.reference}</td>
                  <td><Link className="row" href={`/admin/inquiries/${i.id}`}>{i.company_name}</Link><small>{i.contact_name}</small></td>
                  <td><SourcePill source={i.source} /></td>
                  <td>{i.inquiry_services.map((s) => s.services?.name).filter(Boolean).join(", ")}</td>
                  <td>{fmtDate(i.created_at)}</td>
                  <td>{personName(i.assignee)}</td>
                  <td><StagePill stage={i.status} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="muted">No inquiries match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
