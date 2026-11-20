import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { listProjects, listTasks } from "@/modules/projects/queries";
import { progress, projectStatusLabel, projectTone } from "@/modules/projects/labels";
import { fmtDate } from "@/modules/inquiries/labels";
import { personName } from "@/modules/inquiries/admin-queries";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function ProjectsPage() {
  await requireStaff();
  const projects = await listProjects();
  const tasks = await listTasks(projects.map((p) => p.id));

  return (
    <>
      <div className="top">
        <div>
          <h1>Projects</h1>
          <div className="sub">One project per service line of a signed agreement. They appear here when Atlas confirms the signature.</div>
        </div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>Project</th><th>Client</th><th>Coordinator</th><th>Progress</th><th>Since</th><th>Stage</th></tr></thead>
          <tbody>
            {projects.map((p) => {
              const mine = tasks.filter((t) => t.project_id === p.id);
              return (
                <tr key={p.id}>
                  <td><Link className="row" href={`/admin/projects/${p.id}`}>{p.name}</Link><small>{p.agreement?.number}</small></td>
                  <td><Link href={`/admin/clients/${p.organization_id}`}>{p.organization?.name}</Link></td>
                  <td>{p.coordinator ? personName(p.coordinator) : <span className="st red">Not assigned</span>}</td>
                  <td>{mine.length ? `${progress(mine)}% · ${mine.length} task${mine.length === 1 ? "" : "s"}` : "No tasks"}</td>
                  <td>{fmtDate(p.created_at)}</td>
                  <td><span className={`st ${projectTone(p.status)}`}>{projectStatusLabel(p.status)}</span></td>
                </tr>
              );
            })}
            {!projects.length && <tr><td colSpan={6} className="muted">No projects yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
