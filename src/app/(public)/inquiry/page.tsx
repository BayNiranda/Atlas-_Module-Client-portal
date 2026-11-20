import type { Metadata } from "next";
import { Suspense } from "react";
import { getPublicServices } from "@/modules/services/queries";
import { waLink } from "@/lib/site";
import { PageHead } from "../_components/page-head";
import { InquiryForm } from "./inquiry-form";

export const metadata: Metadata = { title: "Request a consultation · Atlas Advisory" };

export default function InquiryPage({ searchParams }: PageProps<"/inquiry">) {
  return (
    <>
      <PageHead
        top={<span className="pill"><i />Contact · ຕິດຕໍ່</span>}
        title="Request a consultation"
        lao="ຂໍຄຳປຶກສາ"
        sub="Tell us about your business. A member of our team will contact you within two working days. You do not need an account."
      />
      <section className="sec3">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="note" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>Prefer to talk first? Most clients start with a quick WhatsApp chat.</span>
            <a className="btn btn-wa btn-sm" href={waLink("Hello Atlas Advisory, I would like to discuss my business.")} target="_blank" rel="noopener noreferrer">
              Chat on WhatsApp
            </a>
          </div>
          <Suspense fallback={<div className="panel">Loading form…</div>}>
            <FormWithPreselect searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

// "?service=accounting" (from a service page) pre-ticks that service.
async function FormWithPreselect({ searchParams }: { searchParams: PageProps<"/inquiry">["searchParams"] }) {
  const [services, sp] = await Promise.all([getPublicServices(), searchParams]);
  const wanted = typeof sp.service === "string" ? sp.service : null;
  const preselected = services.some((s) => s.slug === wanted) ? wanted : null;
  return <InquiryForm services={services.map(({ slug, name }) => ({ slug, name }))} preselected={preselected} />;
}
