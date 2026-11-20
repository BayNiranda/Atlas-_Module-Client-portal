import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicService, getPublicServices } from "@/modules/services/queries";
import { waLink } from "@/lib/site";
import { PageHead } from "../../_components/page-head";

// Pages for the published services are built ahead; unknown slugs hit notFound() below.
// The whole page depends on the slug, so there is no instant shell to show first.
export const instant = false;

export async function generateStaticParams() {
  return (await getPublicServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const s = await getPublicService((await params).slug);
  return { title: s ? `${s.name} · Atlas Advisory` : "Atlas Advisory" };
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const s = await getPublicService((await params).slug);
  if (!s) notFound();

  return (
    <>
      <PageHead top={<Link href="/services">← All services</Link>} title={s.name} lao={s.name_lo} sub={s.summary} />
      <section className="sec3">
        <div className="wrap">
          <div className="svc-detail">
            <div>
              <div className="panel">
                <h3>What is included</h3>
                <ul className="dots">{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
              <div className="panel">
                <h3>Who it is for</h3>
                <p style={{ margin: 0 }}>{s.audience}</p>
              </div>
            </div>
            <div>
              <div className="panel">
                <h3>What you receive</h3>
                <ul className="dots">{s.deliverables.map((i) => <li key={i}>{i}</li>)}</ul>
                <div className="note" style={{ margin: "14px 0" }}>
                  After your consultation, you complete the <b>{s.assessment_name}</b> in your client portal. We use
                  it to define the scope before preparing a proposal.
                </div>
                <a className="btn btn-wa" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
                   href={waLink(`Hello Atlas Advisory, I would like to discuss ${s.name}.`)} target="_blank" rel="noopener noreferrer">
                  Discuss on WhatsApp
                </a>
                <Link className="btn btn-o" style={{ width: "100%", justifyContent: "center" }} href={`/inquiry?service=${s.slug}`}>
                  Or send the inquiry form
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
