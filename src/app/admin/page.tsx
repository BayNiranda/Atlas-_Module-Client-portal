import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { dashboardCounts, listInquiries, personName, upcomingConsultations } from "@/modules/inquiries/admin-queries";
import { fmtDateTime, modeLabel, TZ } from "@/modules/inquiries/labels";
import { StagePill } from "./_components/pills";

// Waits for the login check on the server before sending the page.
export const instant = false;

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function AdminHome() {
  // Pages check again: layouts are not re-run on every navigation.
  const user = await requireStaff();
  const [counts, latest, upcoming] = await Promise.all([dashboardCounts(), listInquiries(), upcomingConsultations()]);
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <div className="top">
        <div>
          <h1>{greeting()}, {user.fullName?.split(" ")[0] ?? "there"}</h1>
          <div className="sub">{today}</div>
        </div>
        <Link className="btn btn-p" href="/admin/inquiries">Review inquiries</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="l">New inquiries</div><div className="v">{counts.newCount}</div><div className="s">awaiting first contact</div></div>
        <div className="kpi"><div className="l">WhatsApp discussions</div><div className="v">{counts.whatsappOpen}</div><div className="s">open first conversations</div></div>
        <div className="kpi"><div className="l">Upcoming consultations</div><div className="v">{counts.upcoming}</div><div className="s">scheduled from today</div></div>
      </div>

      <div className="cols">
        <div className="tbl">
          <div className="tbl-head"><h3 style={{ margin: 0 }}>Latest inquiries</h3><Link href="/admin/inquiries">View all</Link></div>
          <table>
            <tbody>
              {latest.slice(0, 6).map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link className="row" href={`/admin/inquiries/${i.id}`}>{i.company_name}</Link>
                    <small>{i.inquiry_services.map((s) => s.services?.name).filter(Boolean).join(", ")}</small>
                  </td>
                  <td><StagePill stage={i.status} /></td>
                </tr>
              ))}
              {!latest.length && <tr><td className="muted">No inquiries yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Upcoming consultations</h3>
          {upcoming.length ? (
            <ul className="notes" style={{ marginTop: 0 }}>
              {upcoming.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/inquiries/${c.inquiry?.id}`}>{c.inquiry?.company_name}</Link>
                  <small style={{ display: "block" }}>{fmtDateTime(c.scheduled_at)} · {modeLabel(c.mode)} · {personName(c.consultant)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing scheduled.</p>
          )}
        </div>
      </div>
    </>
  );
}
