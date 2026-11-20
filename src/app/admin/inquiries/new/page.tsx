import Link from "next/link";
import { MANAGERS, requireStaff } from "@/lib/auth/guards";
import { createLead } from "@/modules/inquiries/admin-actions";
import { getPublicServices } from "@/modules/services/queries";
import { ActionForm } from "@/components/action-form";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function NewLeadPage() {
  await requireStaff(MANAGERS);
  const services = await getPublicServices();

  return (
    <>
      <p className="muted"><Link href="/admin/inquiries">← All inquiries</Link></p>
      <div className="top">
        <div>
          <h1>Log a WhatsApp lead</h1>
          <div className="sub">For people who contacted Atlas on WhatsApp, by phone or by referral, so they join the same pipeline.</div>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 760 }}>
        <ActionForm action={createLead} submit="Save lead">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="source">Channel</label>
              <select id="source" name="source" defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="company_name">Company name <span className="req">*</span></label>
              <input id="company_name" name="company_name" required maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="contact_name">Contact name <span className="req">*</span></label>
              <input id="contact_name" name="contact_name" required maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone / WhatsApp <span className="req">*</span></label>
              <input id="phone" name="phone" type="tel" placeholder="+856 20 …" required />
            </div>
            <div className="field full">
              <label htmlFor="email">Email <span className="opt">(optional)</span></label>
              <input id="email" name="email" type="email" />
            </div>
            <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink2)", marginBottom: 5 }}>Services <span className="req">*</span></legend>
              <div className="checks">
                {services.map((s) => (
                  <label className="chk" key={s.slug}><input type="checkbox" name="services" value={s.slug} />{s.name}</label>
                ))}
              </div>
            </fieldset>
            <div className="field full">
              <label htmlFor="challenge">What they need <span className="req">*</span></label>
              <textarea id="challenge" name="challenge" required maxLength={4000} placeholder="Summary of the WhatsApp conversation…" />
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
