import Link from "next/link";
import { requireClient } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/modules/portal/org";
import { roleLabel } from "@/modules/inquiries/labels";
import { waLink } from "@/lib/site";

// Waits for the login check on the server before sending the page.
export const instant = false;

const STEPS = ["Discussion", "Consultation", "Pre-assessment", "Proposal", "Agreement", "Onboarding", "Service delivery"];
// Where each inquiry stage sits on the client's progress track.
// shortcut: comes from the original inquiry until Modules 4-8 add real proposal/agreement/project statuses.
const STAGE_STEP: Record<string, number> = { new: 0, discussion: 0, consultation: 1, pre_assessment: 2, proposal: 3, agreement: 4, won: 5 };

type Overview = { stage: string | null; services: string[]; contact_name: string | null; contact_role: string | null } | null;

export default async function PortalHome() {
  const user = await requireClient();
  const { current } = await getCurrentOrg(user.id);

  if (!current) {
    return (
      <div className="panel" style={{ maxWidth: 640 }}>
        <h1>Welcome</h1>
        <p>Your account is not linked to a company yet. Atlas Advisory will connect it shortly.</p>
        <a className="btn btn-wa" href={waLink("Hello Atlas Advisory, my portal account is not linked to a company yet.")} target="_blank" rel="noopener noreferrer">Contact Atlas on WhatsApp</a>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("org_overview", { p_org: current.orgId });
  const overview = data as Overview;
  const step = STAGE_STEP[overview?.stage ?? "pre_assessment"] ?? 2;
  const status = (i: number, before: string, at: string, after: string) => (step < i ? before : step === i ? at : after);
  const firstName = user.fullName?.split(" ")[0];

  const nextSteps: { title: string; detail: string; href?: string; cta?: string }[] = [];
  if (step <= 1) nextSteps.push({ title: "Atlas will contact you to arrange your consultation", detail: "Usually within two working days" });
  if (step === 2) nextSteps.push({ title: "Your pre-assessment is being prepared", detail: "Your coordinator will share the questionnaire here. It defines the scope of work for your proposal." });
  if (step >= 3) nextSteps.push({ title: "Your coordinator will guide you through the next step", detail: "You will be notified here when something needs your attention." });
  if (!user.fullName) nextSteps.push({ title: "Add your name to your profile", detail: "So the Atlas team knows who they are talking to", href: "/account/profile", cta: "Profile" });
  if (current.role === "CLIENT_OWNER") nextSteps.push({ title: "Give colleagues access", detail: "Add your accountant or manager to this portal", href: "/portal/colleagues", cta: "Colleagues" });

  return (
    <>
      <div className="top">
        <div>
          <h1>Welcome{firstName ? `, ${firstName}` : ""}</h1>
          <div className="sub">{current.orgName}{overview?.services.length ? ` · ${overview.services.join(", ")}` : ""}</div>
        </div>
      </div>

      <div className="panel">
        <h3>Engagement progress</h3>
        <div className="track">
          {STEPS.map((label, i) => (
            <div key={label} className={i < step ? "done" : undefined} aria-current={i === step ? "step" : undefined}>{label}</div>
          ))}
        </div>
        <div className="statusgrid">
          <div>Pre-assessment<b>{status(2, "Not started", "Being prepared", "Approved")}</b></div>
          <div>Proposal<b>{status(3, "Locked", "Awaiting your decision", "Accepted")}</b></div>
          <div>Agreement<b>{status(4, "Not started", "Awaiting signature", "Signed")}</b></div>
          <div>Service delivery<b>{status(5, "Not started", "Onboarding", "Active")}</b></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Your proposal is prepared only after Atlas has assessed the scope of work with you.</p>
      </div>

      <div className="cols" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Your next steps</h3>
          <div className="list">
            {nextSteps.map((n) => (
              <div className="item" key={n.title}>
                <div>{n.title}<small>{n.detail}</small></div>
                {n.href && <Link className="btn btn-sm btn-o" href={n.href}>{n.cta}</Link>}
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Your Atlas team</h3>
          <div className="list">
            <div className="item">
              <div>
                <b>{overview?.contact_name ?? "Atlas Advisory team"}</b>
                <small>{overview?.contact_role ? roleLabel(overview.contact_role) : "We will assign your coordinator shortly"}</small>
              </div>
            </div>
          </div>
          <a className="btn btn-wa btn-sm" style={{ marginTop: 8 }} target="_blank" rel="noopener noreferrer"
             href={waLink(`Hello${overview?.contact_name ? ` ${overview.contact_name}` : ""}, this is ${user.fullName ?? "a client"} from ${current.orgName}.`)}>
            WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}
