import Link from "next/link";
import { notFound } from "next/navigation";
import { MANAGERS, requireStaff } from "@/lib/auth/guards";
import { getInquiry, listStaff, personName } from "@/modules/inquiries/admin-queries";
import {
  addInquiryNote, scheduleConsultation, setConsultationStatus, updateInquiry,
} from "@/modules/inquiries/admin-actions";
import {
  CONSULTATION_MODES, CONSULTATION_STATUSES, fmtDate, fmtDateTime,
  MANUAL_STAGES, modeLabel, QUALIFICATIONS, sourceLabel, stageLabel,
} from "@/modules/inquiries/labels";
import { waTo } from "@/modules/inquiries/whatsapp";
import { ActionForm } from "../../_components/action-form";
import { StagePill } from "../../_components/pills";
import { ConvertForm, NewLinkForm } from "./convert-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function InquiryDetail({ params }: PageProps<"/admin/inquiries/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [result, staff] = await Promise.all([getInquiry(id), listStaff()]);
  if (!result) notFound();
  const { inquiry: i, consultations, notes } = result;

  const canManage = MANAGERS.includes(user.staffRole);
  const manualStage = (MANUAL_STAGES as readonly string[]).includes(i.status);
  const activeStaff = staff.filter((s) => s.is_active);
  const services = i.inquiry_services.map((s) => s.services?.name).filter(Boolean).join(", ");

  return (
    <>
      <p className="muted"><Link href="/admin/inquiries">← All inquiries</Link> · {i.reference}</p>
      <div className="top">
        <div>
          <h1>{i.company_name}</h1>
          <StagePill stage={i.status} />
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <a className="btn btn-wa btn-sm" href={waTo(i.phone, `Hello ${i.contact_name}, this is Atlas Advisory following up on your inquiry ${i.reference}.`)} target="_blank" rel="noopener noreferrer">
            Reply on WhatsApp
          </a>
          {i.email && <a className="btn btn-o btn-sm" href={`mailto:${i.email}?subject=${encodeURIComponent(`Your inquiry ${i.reference}`)}`}>Email</a>}
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="panel">
            <dl className="dl">
              <dt>Contact</dt><dd>{i.contact_name}</dd>
              <dt>Email</dt><dd>{i.email ?? "—"}</dd>
              <dt>Phone / WhatsApp</dt><dd>{i.phone}</dd>
              <dt>Industry</dt><dd>{i.industry ?? "—"}</dd>
              <dt>Company size</dt><dd>{i.company_size ?? "—"}</dd>
              <dt>Services</dt><dd>{services || "—"}</dd>
              <dt>Preferred date</dt><dd>{i.preferred_date ? fmtDate(i.preferred_date) : "—"}</dd>
              <dt>Received</dt><dd>{fmtDateTime(i.created_at)}</dd>
              <dt>Channel</dt><dd>{sourceLabel(i.source)}{i.creator ? ` · logged by ${personName(i.creator)}` : ""}</dd>
              {i.organization && (<><dt>Client</dt><dd>{i.organization.name}</dd></>)}
            </dl>
            <h3>Business challenge</h3>
            <p className="challenge">{i.challenge}</p>
          </div>

          <div className="panel">
            <h3>Consultations</h3>
            {consultations.length ? (
              <div className="tbl" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>When</th><th>How</th><th>Consultant</th><th>Status</th></tr></thead>
                  <tbody>
                    {consultations.map((c) => (
                      <tr key={c.id}>
                        <td>{fmtDateTime(c.scheduled_at)}{c.location && <small>{c.location}</small>}</td>
                        <td>{modeLabel(c.mode)}</td>
                        <td>{personName(c.consultant)}</td>
                        <td>
                          <ActionForm action={setConsultationStatus} submit="Update" className="inline-status">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="inquiry_id" value={i.id} />
                            <select name="status" defaultValue={c.status} aria-label="Consultation status">
                              {CONSULTATION_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                            </select>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">None yet.</p>
            )}
            <details>
              <summary className="btn btn-o btn-sm">Schedule consultation</summary>
              <ActionForm action={scheduleConsultation} submit="Schedule">
                <input type="hidden" name="inquiry_id" value={i.id} />
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label htmlFor="scheduled_at">Date and time (Lao time)</label>
                    <input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
                  </div>
                  <div className="field">
                    <label htmlFor="mode">How</label>
                    <select id="mode" name="mode">{CONSULTATION_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>
                  <div className="field">
                    <label htmlFor="consultant_id">Consultant</label>
                    <select id="consultant_id" name="consultant_id" defaultValue={user.id}>
                      {activeStaff.map((s) => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="location">Place or meeting link <span className="opt">(optional)</span></label>
                    <input id="location" name="location" maxLength={300} />
                  </div>
                </div>
              </ActionForm>
            </details>
          </div>
        </div>

        <div>
          <div className="internal">
            <b>INTERNAL · NEVER VISIBLE TO CLIENTS</b>
            {canManage ? (
              <ActionForm action={updateInquiry} submit="Save changes">
                <input type="hidden" name="id" value={i.id} />
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label htmlFor="assigned_to">Assign to</label>
                    <select id="assigned_to" name="assigned_to" defaultValue={i.assigned_to ?? ""}>
                      <option value="">— Unassigned</option>
                      {activeStaff.map((s) => <option key={s.id} value={s.id}>{personName(s)}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="status">Stage</label>
                    {manualStage ? (
                      <select id="status" name="status" defaultValue={i.status}>
                        {MANUAL_STAGES.map((k) => <option key={k} value={k}>{stageLabel(k)}</option>)}
                      </select>
                    ) : (
                      <input id="status" value={stageLabel(i.status)} disabled title="Set by later steps (assessment, proposal, agreement)" />
                    )}
                  </div>
                  <div className="field full">
                    <label htmlFor="qualification">Qualification: complexity / capacity / risk</label>
                    <select id="qualification" name="qualification" defaultValue={i.qualification ?? ""}>
                      <option value="">— Not assessed</option>
                      {QUALIFICATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </ActionForm>
            ) : (
              <dl className="dl" style={{ marginBottom: 0 }}>
                <dt>Owner</dt><dd>{personName(i.assignee)}</dd>
                <dt>Qualification</dt><dd>{QUALIFICATIONS.find(([k]) => k === i.qualification)?.[1] ?? "—"}</dd>
              </dl>
            )}

            <h3 style={{ marginTop: 18 }}>Notes</h3>
            <ActionForm action={addInquiryNote} submit="Add note">
              <input type="hidden" name="entity_id" value={i.id} />
              <label htmlFor="body" className="muted">New note (cannot be edited or deleted later)</label>
              <textarea id="body" name="body" maxLength={5000} placeholder="Preliminary findings from first call…" />
            </ActionForm>
            <ul className="notes">
              {notes.map((n) => (
                <li key={n.id}>
                  <small>{personName(n.author)} · {fmtDateTime(n.created_at)}</small>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          </div>

          {canManage && !i.organization && i.status !== "not_a_fit" && i.status !== "spam" && (
            <div className="panel" style={{ marginTop: 16 }}>
              <h3>Create client &amp; invite</h3>
              <ConvertForm inquiryId={i.id} company={i.company_name} contact={i.contact_name} email={i.email} />
            </div>
          )}
          {canManage && i.organization && (
            <div className="panel" style={{ marginTop: 16 }}>
              <h3>Client portal access</h3>
              <NewLinkForm inquiryId={i.id} />
            </div>
          )}
          <p className="muted" style={{ marginTop: 14 }}>Every stage change is written to the activity log with who and when.</p>
        </div>
      </div>
    </>
  );
}
