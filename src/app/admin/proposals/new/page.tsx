import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { DEFAULT_EXCLUSIONS, DEFAULT_PAYMENT_TERMS, DEFAULT_TERMS, DEFAULT_VALID_DAYS } from "@/modules/proposals/defaults";
import { laoToday } from "@/modules/proposals/labels";
import { editorChoices } from "../data";
import { ProposalEditor } from "../proposal-editor";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function NewProposalPage({ searchParams }: PageProps<"/admin/proposals/new">) {
  await requireStaff();
  const [{ orgs, services }, sp] = await Promise.all([editorChoices(), searchParams]);
  const preselected = typeof sp.org === "string" && orgs.some((o) => o.id === sp.org) ? sp.org : "";
  const validUntil = new Date(`${laoToday()}T00:00:00Z`);
  validUntil.setUTCDate(validUntil.getUTCDate() + DEFAULT_VALID_DAYS);

  return (
    <>
      <p className="muted"><Link href="/admin/proposals">← All proposals</Link></p>
      <div className="top"><div><h1>New proposal</h1><div className="sub">Saved as a draft. Clients never see drafts.</div></div></div>
      {orgs.length ? (
        <ProposalEditor
          orgs={orgs}
          services={services}
          initial={{
            organization_id: preselected, title: "", currency: "USD", valid_until: validUntil.toISOString().slice(0, 10),
            introduction: "", exclusions: DEFAULT_EXCLUSIONS, payment_terms: DEFAULT_PAYMENT_TERMS, terms: DEFAULT_TERMS, items: [],
          }}
        />
      ) : (
        <p className="muted">There are no client companies yet. Convert an inquiry into a client first.</p>
      )}
    </>
  );
}
