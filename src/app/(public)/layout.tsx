import "./public.css";
import Link from "next/link";
import { Suspense } from "react";
import { getPublicServices } from "@/modules/services/queries";
import { site, waLink } from "@/lib/site";
import { NavLinks } from "./_components/nav-links";
import { WhatsAppWidget } from "./_components/whatsapp-widget";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const services = await getPublicServices();
  const topics = [
    ...services.map((s) => ({ label: s.name, message: `Hello Atlas Advisory, I would like to discuss ${s.name} for my company.` })),
    { label: "Something else", message: "Hello Atlas Advisory, I have a question." },
  ];

  return (
    <div className="site">
      <div className="annc">
        The new Income Tax Law is in effect from 1 July 2026.{" "}
        <a href={waLink("Hello Atlas Advisory, what does the new Income Tax Law mean for my business?")} target="_blank" rel="noopener noreferrer">
          Ask us what it means for your business →
        </a>
      </div>
      <header className="pub-nav">
        <div className="in">
          <Link className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo, already optimised */}
            <img src="/brand/mark.webp" alt="" width={52} height={40} />
            <span className="wm">
              <b>ATLAS</b>
              <em>ADVISORY</em>
            </span>
          </Link>
          <Suspense fallback={<nav />}>
            <NavLinks />
          </Suspense>
          <Link className="btn btn-o btn-sm" href="/login">
            Client login
          </Link>
          <a className="btn btn-wa btn-sm" href={waLink("Hello Atlas Advisory, I would like to discuss my business.")} target="_blank" rel="noopener noreferrer">
            WhatsApp us
          </a>
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer3">
        <div className="lao-band" />
        <div className="in">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
            <img src="/brand/logo.webp" alt="Atlas Advisory" width={150} style={{ height: "auto", marginBottom: 14 }} />
            <p>Accounting, financial advisory and business services for Lao SMEs.</p>
            <p style={{ fontFamily: "var(--lao)" }}>ບໍລິການບັນຊີ ແລະ ທີ່ປຶກສາທຸລະກິດ ສຳລັບ SME ລາວ</p>
          </div>
          <div>
            <b>Services</b>
            {services.map((s) => (
              <Link key={s.slug} href={`/services/${s.slug}`}>
                {s.name}
              </Link>
            ))}
          </div>
          <div>
            <b>Company</b>
            <Link href="/#how-we-work">How we work</Link>
            <Link href="/#tools">Free tools</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/login">Client login</Link>
          </div>
          <div>
            <b>Contact</b>
            <span style={{ display: "block", margin: "4px 0" }}>{site.city}</span>
            <a href={waLink("Hello Atlas Advisory")} target="_blank" rel="noopener noreferrer">
              WhatsApp {site.whatsappDisplay}
            </a>
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </div>
        </div>
      </footer>

      <WhatsAppWidget topics={topics} />
    </div>
  );
}
