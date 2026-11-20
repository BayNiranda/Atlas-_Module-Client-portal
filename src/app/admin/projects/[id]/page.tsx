import Link from "next/link";
import { notFound } from "next/navigation";
import { MANAGERS, requireStaff } from "@/lib/auth/guards";
import { getProject, listTasks, projectTeam, type Task } from "@/modules/projects/queries";
import { deleteTask, saveTask, setProjectStatus, setProjectTeam, setTaskStatus } from "@/modules/projects/actions";
import { progress, PROJECT_STATUS, projectStatusLabel, projectTone, TASK_STATUS, taskStatusLabel, taskTone } from "@/modules/projects/labels";
import { fmtDate, roleLabel } from "@/modules/inquiries/labels";
import { listStaff, personName } from "@/modules/inquiries/admin-queries";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

type Staff = Awaited<ReturnType<typeof listStaff>>;

function TaskFields({ t, staff, prefix }: { t?: Task; staff: Staff; prefix: string }) {
  return (
    <>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor={`${prefix}-title`}>Task</label>
        <input id={`${prefix}-title`} name="title" maxLength={200} defaultValue={t?.title} required />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor={`${prefix}-desc`}>Details <span className="opt">(optional)</span></label>
        <textarea id={`${prefix}-desc`} name="description" maxLength={2000} defaultValue={t?.description ?? ""} />
      </div>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="field">
          <label htmlFor={`${prefix}-status`}>Status</label>
          <select id={`${prefix}-status`} name="status" defaultValue={t?.status ?? "todo"}>
            {TASK_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-due`}>Due date <span className="opt">(optional)</span></label>
          <input id={`${prefix}-due`} name="due_date" type="date" defaultValue={t?.due_date ?? ""} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor={`${prefix}-who`}>Assigned to</label>
        <select id={`${prefix}-who`} name="assignee_id" defaultValue={t?.assignee_id ?? ""}>
          <option value="">Nobody yet</option>
          {staff.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{personName(s)}</option>)}
        </select>
      </div>
      <label className="chk" style={{ marginTop: 8 }}>
        <input type="checkbox" name="client_visible" defaultChecked={t?.client_visible ?? false} /> Client can see this task
      </label>
    </>
  );
}

export default async function ProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const project = await getProject(id);
  if (!project) notFound();
  const [tasks, team, staff] = await Promise.all([listTasks([id]), projectTeam(id), listStaff()]);

  const manager = MANAGERS.includes(user.staffRole);
  const canEditTasks = manager || project.coordinator_id === user.id || team.includes(user.id);
  const visible = tasks.filter((t) => t.client_visible);

  return (
    <>
      <p className="muted"><Link href="/admin/projects">← All projects</Link></p>
      <div className="top">
        <div>
          <h1>{project.name}</h1>
          <div className="sub">
            <Link href={`/admin/clients/${project.organization_id}`}>{project.organization?.name}</Link>
            {" · "}<Link href={`/admin/agreements/${project.agreement_id}`}>{project.agreement?.number}</Link>
            {project.started_at && ` · started ${fmtDate(project.started_at)}`}
            {project.completed_at && ` · completed ${fmtDate(project.completed_at)}`}
          </div>
        </div>
        <span className={`st ${projectTone(project.status)}`}>{projectStatusLabel(project.status)}</span>
      </div>

      <div className="cols">
        <div>
          <div className="panel">
            <h3>Tasks</h3>
            <p className="muted">
              Progress {progress(tasks)}% overall · the client sees {visible.length} task{visible.length === 1 ? "" : "s"} ({progress(visible)}% done).
            </p>
            {tasks.length ? tasks.map((t) => (
              <div key={t.id} className="request">
                <div className="request-head">
                  <div>
                    <b>{t.title}</b>{" "}
                    {t.client_visible ? <span className="st green">Client sees</span> : <span className="st grey">Internal</span>}
                    <small>
                      {t.assignee ? personName(t.assignee) : "Unassigned"}
                      {t.due_date ? ` · due ${fmtDate(t.due_date)}` : ""}
                      {t.completed_at ? ` · done ${fmtDate(t.completed_at)}` : ""}
                    </small>
                    {t.description && <small className="challenge">{t.description}</small>}
                  </div>
                  <span className={`st ${taskTone(t.status)}`}>{taskStatusLabel(t.status)}</span>
                </div>
                {canEditTasks && (
                  <div className="review-actions">
                    <ActionForm action={setTaskStatus} submit="Set" className="inline-status">
                      <input type="hidden" name="id" value={t.id} />
                      <select name="status" defaultValue={t.status} aria-label={`Status of ${t.title}`}>
                        {TASK_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </ActionForm>
                    <details>
                      <summary className="btn btn-o btn-sm">Edit…</summary>
                      <ActionForm action={saveTask} submit="Save task">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <TaskFields t={t} staff={staff} prefix={`t-${t.id}`} />
                      </ActionForm>
                      <ActionForm action={deleteTask} submit="Delete task" className="inline-status">
                        <input type="hidden" name="id" value={t.id} />
                      </ActionForm>
                    </details>
                  </div>
                )}
              </div>
            )) : <p className="muted" style={{ margin: 0 }}>No tasks yet.</p>}
          </div>

          {canEditTasks && (
            <div className="panel">
              <h3>Add a task</h3>
              <ActionForm action={saveTask} submit="Add task">
                <input type="hidden" name="id" value="" />
                <input type="hidden" name="project_id" value={id} />
                <TaskFields staff={staff} prefix="new" />
              </ActionForm>
            </div>
          )}
        </div>

        <div>
          {manager ? (
            <>
              <div className="internal">
                <b>STAGE</b>
                <ActionForm action={setProjectStatus} submit="Update stage">
                  <input type="hidden" name="id" value={id} />
                  <div className="field" style={{ marginTop: 8 }}>
                    <label htmlFor="status">Stage (the client is notified)</label>
                    <select id="status" name="status" defaultValue={project.status}>
                      {PROJECT_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                </ActionForm>
              </div>

              <div className="panel" style={{ marginTop: 16 }}>
                <h3>Team</h3>
                <ActionForm action={setProjectTeam} submit="Save team">
                  <input type="hidden" name="id" value={id} />
                  <div className="field">
                    <label htmlFor="coordinator">Coordinator (the client sees this name)</label>
                    <select id="coordinator" name="coordinator" defaultValue={project.coordinator_id ?? ""}>
                      <option value="">Not assigned</option>
                      {staff.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </select>
                  </div>
                  <fieldset className="field" style={{ marginTop: 8, border: 0, padding: 0 }}>
                    <legend>Also working on it</legend>
                    {staff.filter((s) => s.is_active).map((s) => (
                      <label key={s.id} className="chk" style={{ marginTop: 6 }}>
                        <input type="checkbox" name="staff" value={s.id} defaultChecked={team.includes(s.id)} />{" "}
                        {personName(s)} <span className="muted">· {roleLabel(s.staff_role)}</span>
                      </label>
                    ))}
                  </fieldset>
                </ActionForm>
              </div>
            </>
          ) : (
            <div className="panel">
              <h3>Team</h3>
              <p>Coordinator: {project.coordinator ? personName(project.coordinator) : "not assigned"}</p>
              <p className="muted" style={{ margin: 0 }}>
                {canEditTasks ? "You are on this project and can manage its tasks." : "Only staff on this project can change its tasks."}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
