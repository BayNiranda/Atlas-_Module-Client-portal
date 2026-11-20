import { requireStaff } from "@/lib/auth/guards";
import { listStaff, personName } from "@/modules/inquiries/admin-queries";
import { roleLabel, STAFF_ROLES } from "@/modules/inquiries/labels";
import { setStaffAccess } from "@/modules/team/actions";
import { ActionForm } from "../_components/action-form";
import { InviteStaffForm } from "./invite-staff-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function TeamPage() {
  const me = await requireStaff(["SUPER_ADMIN"]);
  const staff = await listStaff();

  return (
    <>
      <div className="top">
        <div>
          <h1>Team</h1>
          <div className="sub">Atlas staff and their roles. Every change is recorded in the activity log.</div>
        </div>
      </div>

      <div className="tbl" style={{ marginBottom: 22 }}>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Change access</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><b>{personName(s)}</b><small>{s.email}</small></td>
                <td>{roleLabel(s.staff_role)}</td>
                <td><span className={`st ${s.is_active ? "green" : "red"}`}>{s.is_active ? "Active" : "Deactivated"}</span></td>
                <td>
                  {s.id === me.id ? (
                    <span className="muted">You</span>
                  ) : (
                    <ActionForm action={setStaffAccess} submit="Save" className="inline-status">
                      <input type="hidden" name="user_id" value={s.id} />
                      <select name="role" defaultValue={s.staff_role ?? "none"} aria-label={`Role for ${personName(s)}`}>
                        {STAFF_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        <option value="none">Remove staff access</option>
                      </select>
                      <select name="active" defaultValue={String(s.is_active)} aria-label={`Status for ${personName(s)}`}>
                        <option value="true">Active</option>
                        <option value="false">Deactivated</option>
                      </select>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ maxWidth: 760 }}>
        <h3>Add a staff member</h3>
        <p className="muted">Creates their login and gives you a one-time link to send them.</p>
        <InviteStaffForm />
      </div>
    </>
  );
}
