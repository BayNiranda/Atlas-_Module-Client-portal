import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guards";
import { getCurrentOrg } from "@/modules/portal/org";
import { coordinatorNames, listProjects, listTasks } from "@/modules/projects/queries";
import { progress, projectStatusLabel, projectTone, taskStatusLabel, taskTone } from "@/modules/projects/labels";
import { fmtDate } from "@/modules/inquiries/labels";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalProjects() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);
  if (!current) redirect("/portal");

  const [projects, coordinators] = await Promise.all([listProjects({ orgId: current.orgId }), coordinatorNames(current.orgId)]);
  const tasks = await listTasks(projects.map((p) => p.id)); // RLS: client-visible tasks only

  return (
    <>
      <div className="top">
        <div>
          <h1>Projects</h1>
          <div className="sub">Follow the work Atlas is doing for {current.orgName}. Need something else? <Link href="/portal/requests">Send a request</Link>.</div>
        </div>
      </div>

      {!projects.length && (
        <div className="panel" style={{ maxWidth: 980 }}>
          <p className="muted" style={{ margin: 0 }}>Your projects appear here once your agreement with Atlas is signed.</p>
        </div>
      )}

      {projects.map((p) => {
        const mine = tasks.filter((t) => t.project_id === p.id);
        const pct = progress(mine);
        return (
          <div key={p.id} className="panel" style={{ maxWidth: 980 }}>
            <div className="request-head">
              <div>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <small className="muted">
                  Coordinator: {coordinators.get(p.id) ?? "being assigned"}
                  {p.started_at && ` · started ${fmtDate(p.started_at)}`}
                  {p.completed_at && ` · completed ${fmtDate(p.completed_at)}`}
                </small>
              </div>
              <span className={`st ${projectTone(p.status)}`}>{projectStatusLabel(p.status)}</span>
            </div>
            {mine.length > 0 && (
              <>
                <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <small className="muted">{pct}% of steps done</small>
                {mine.map((t) => (
                  <div key={t.id} className="file-row">
                    <div style={{ minWidth: 0 }}>
                      <b>{t.title}</b>
                      <small>{t.due_date ? `Due ${fmtDate(t.due_date)}` : ""}{t.completed_at ? ` · done ${fmtDate(t.completed_at)}` : ""}</small>
                      {t.description && <small className="challenge">{t.description}</small>}
                    </div>
                    <span className={`st ${taskTone(t.status)}`}>{taskStatusLabel(t.status)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
