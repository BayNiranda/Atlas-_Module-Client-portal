import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { listProposals } from "@/modules/proposals/queries";
import { displayStatus, proposalRef, STATUS_LABEL, statusTone } from "@/modules/proposals/labels";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

const FILTERS = ["draft", "sent", "accepted", "declined", "expired", "withdrawn", "superseded"];

export default async function ProposalsPage({ searchParams }: PageProps<"/admin/proposals">) {
  await requireStaff();
  const sp = await searchParams;
  const filter = typeof sp.status === "string" && FILTERS.includes(sp.status) ? sp.status : "";
  const rows = (await listProposals()).filter((p) => !filter || displayStatus(p) === filter);

  return (
    <>
      <div className="top">
        <div>
          <h1>Proposals</h1>
          <div className="sub">Prepared after the scope is assessed. Sent proposals cannot be changed; revise to make a new version.</div>
        </div>
        <Link className="btn btn-p" href="/admin/proposals/new">New proposal</Link>
      </div>
      <div className="tabs">
        <form className="filters" method="get">
          <select name="status" defaultValue={filter} aria-label="Filter by status">
            <option value="">All statuses</option>
            {FILTERS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button className="btn btn-o btn-sm" type="submit">Filter</button>
        </form>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Proposal</th><th>Client</th><th>Title</th><th>Valid until</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const s = displayStatus(p);
              return (
                <tr key={p.id}>
                  <td><Link className="row" href={`/admin/proposals/${p.id}`}>{proposalRef(p)}</Link><small>{p.currency}</small></td>
                  <td>{p.organization?.name}</td>
                  <td>{p.title}</td>
                  <td>{fmtDate(p.valid_until)}</td>
                  <td><span className={`st ${statusTone(s)}`}>{STATUS_LABEL[s]}</span></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="muted">No proposals yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
