import Link from "next/link";
import { getPublicServices } from "@/modules/services/queries";
import { waLink } from "@/lib/site";
import { ServiceCard } from "./_components/service-card";
import { ValueIcon } from "./_components/icons";
import { VatCalculator } from "./_components/vat-calculator";
import { Faq } from "./_components/faq";

const STEPS = [
  ["Chat with us", "ລົມກັນທາງ WhatsApp", "A first discussion on WhatsApp or by form. No commitment."],
  ["Consultation", "ປຶກສາຫາລື", "We understand your situation and confirm we are the right fit."],
  ["Pre-assessment", "ປະເມີນເບື້ອງຕົ້ນ", "A questionnaire for your service defines the scope of work."],
  ["Proposal & agreement", "ຂໍ້ສະເໜີ ແລະ ສັນຍາ", "Fees based on the assessed scope, then signed online."],
  ["Delivery", "ເລີ່ມໃຫ້ບໍລິການ", "Your Atlas team starts the agreed work."],
];

export default async function Home() {
  const services = await getPublicServices();
  const wa = waLink("Hello Atlas Advisory, I would like to discuss my business.");
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <>
      <section className="hero3">
        <div className="wrap">
          <div>
            <span className="pill"><i />Accounting · Advisory · Vientiane</span>
            <h1>Clear numbers.<br /><span>Confident decisions.</span></h1>
            <p className="lao-line" lang="lo">ຕົວເລກທີ່ຊັດເຈນ ເພື່ອການຕັດສິນໃຈທີ່ໝັ້ນໃຈ</p>
            <p className="sub">
              Accounting, financial advisory and business support for Lao SMEs. Start with a short WhatsApp
              conversation. No forms, no commitment.
            </p>
            <div className="cta">
              <a className="btn btn-wa" href={wa} {...ext}>Chat on WhatsApp</a>
              <Link className="btn btn-ghost" href="/services">Explore services</Link>
            </div>
            <div className="trust">
              <span>Lao &amp; English</span>
              <span>Scope assessed before any proposal</span>
              <span>Secure client portal</span>
            </div>
          </div>
          <div className="mock" aria-hidden="true">
            <div className="browser">
              <div className="bar"><i /><i /><i /><div className="url">atlas-advisory.la</div></div>
              <div className="body">
                <div className="skel"><div className="h" /><div className="w80" /><div className="w60" /><div className="blk" /><div className="blk" /><div className="gold" /></div>
                <div className="chatp">
                  <div className="ch">
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative */}
                    <i><img src="/brand/mark.webp" alt="" width={22} /></i>
                    <div><b>Atlas Advisory</b><span>Online on WhatsApp</span></div>
                  </div>
                  <div className="msgs">
                    <div className="m-in">ສະບາຍດີ. Our books are behind. Can you help with monthly accounts?</div>
                    <div className="m-out">ສະບາຍດີ! Yes. Let&rsquo;s talk first, then a short pre-assessment so we can scope the work properly.</div>
                    <div className="chips"><span>Book a call</span><span>Our services</span><span>Fees</span></div>
                  </div>
                  <div className="send">Continue on WhatsApp</div>
                </div>
              </div>
            </div>
            <div className="float f1"><i>1</i>Discussion <em>· free</em></div>
            <div className="float f2"><i>2</i>Pre-assessment <em>· scope first</em></div>
            <div className="float f3"><i>3</i>Proposal <em>· then agreement</em></div>
          </div>
        </div>
      </section>
      <div className="lao-band" />

      <section className="sec3">
        <div className="wrap">
          <div className="eyebrow">Services · ບໍລິການ</div>
          <h2>Four ways we support your business</h2>
          <p className="lede">Every engagement starts with understanding your situation. We assess the scope with you first, so the proposal you receive is accurate.</p>
          <div className="svc3">{services.map((s) => <ServiceCard key={s.slug} s={s} />)}</div>
        </div>
      </section>

      <section className="sec3 alt">
        <div className="wrap">
          <div className="eyebrow">What you get · ສິ່ງທີ່ທ່ານຈະໄດ້ຮັບ</div>
          <h2>An accounting team, without hiring one</h2>
          <p className="lede">Every client gets the same foundations, whatever the package.</p>
          <div className="vp">
            <div className="it"><ValueIcon name="user" /><b>A named accountant</b><span>One person who knows your business, reachable on WhatsApp and in the portal.</span></div>
            <div className="it"><ValueIcon name="cal" /><b>On-time Lao filings</b><span>Tax declarations and statutory reports prepared and tracked against every deadline.</span></div>
            <div className="it"><ValueIcon name="chart" /><b>Reports you can read</b><span>Clear monthly figures in Lao and English, explained in plain language.</span></div>
            <div className="it"><ValueIcon name="lock" /><b>A secure portal</b><span>Documents, agreements and progress in one private place, not scattered across chats.</span></div>
          </div>
          <div className="who">
            <div className="w"><div className="tag">Founders</div><h3>Starting a business</h3><div className="lo" lang="lo">ຜູ້ເລີ່ມຕົ້ນທຸລະກິດ</div><p>Registration guidance, a clean opening set-up and a first-year plan.</p></div>
            <div className="w"><div className="tag">Lao SMEs</div><h3>Growing companies</h3><div className="lo" lang="lo">ວິສາຫະກິດຂະໜາດນ້ອຍ ແລະ ກາງ</div><p>Books that keep up with growth, and numbers owners can manage with.</p></div>
            <div className="w"><div className="tag">Foreign-invested</div><h3>International owners</h3><div className="lo" lang="lo">ບໍລິສັດທີ່ມີການລົງທຶນຕ່າງປະເທດ</div><p>Lao compliance with English reporting for shareholders and head office.</p></div>
          </div>
        </div>
      </section>

      <section className="sec3" id="how-we-work">
        <div className="wrap">
          <div className="eyebrow">How we work · ຂັ້ນຕອນການເຮັດວຽກ</div>
          <h2>From first chat to delivery</h2>
          <p className="lede">A clear, step-by-step process. You always know what happens next.</p>
          <div className="flow3">
            {STEPS.map(([title, lo, text], i) => (
              <div className="f" key={title}>
                <div className="n">{i + 1}</div>
                <b>{title}</b>
                <div className="lo" lang="lo">{lo}</div>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <div className="rule"><b>Our rule:</b> we never send a final proposal before assessing the scope of work. You pay for what your business actually needs.</div>
        </div>
      </section>

      {/* Pricing section hidden until the owner confirms the real price list (approved decision 3). */}

      <section className="sec3 alt">
        <div className="wrap switch">
          <div>
            <div className="eyebrow">Switching · ປ່ຽນມາໃຊ້ Atlas</div>
            <h2>Switching from another accountant?</h2>
            <p className="lede" style={{ marginBottom: 20 }}>We take care of the handover, so nothing is lost and you do not have to chase anyone.</p>
            <a className="btn btn-wa" href={waLink("Hello Atlas Advisory, I would like to switch my accounting to Atlas.")} {...ext}>Talk to us about switching</a>
          </div>
          <ol>
            <li><b>Collect your records</b>We request files and ledgers from your previous accountant, with your permission.</li>
            <li><b>Check opening balances</b>We review the last statements and fix gaps before taking over.</li>
            <li><b>Set up and continue</b>Your books move into our system and monthly service continues without a break.</li>
          </ol>
        </div>
      </section>

      <section className="sec3" id="tools">
        <div className="wrap">
          <div className="eyebrow">Free tools · ເຄື່ອງມືຟຣີ</div>
          <h2>Useful for every business owner</h2>
          <p className="lede">Quick help, even before you become a client.</p>
          <VatCalculator />
        </div>
      </section>

      <section className="sec3 alt" id="faq">
        <div className="wrap faq-wrap">
          <div className="eyebrow">FAQ · ຄຳຖາມທີ່ພົບເລື້ອຍ</div>
          <h2>Common questions</h2>
          <p className="lede">Can&rsquo;t find your answer? Ask us on WhatsApp.</p>
          <Faq />
          <p style={{ marginTop: 16 }}>
            <a className="btn btn-o" href={waLink("Hello Atlas Advisory, I have a question.")} {...ext}>Ask your question</a>
          </p>
        </div>
      </section>

      <section className="sec3">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <div className="lo" lang="lo">ພ້ອມລົມກັນແລ້ວບໍ?</div>
              <h2>Ready to talk about your business?</h2>
              <p>Send us a message on WhatsApp. A real person from our team will reply.</p>
            </div>
            <div className="cta">
              <a className="btn btn-wa" href={wa} {...ext}>Chat on WhatsApp</a>
              <Link className="btn btn-ghost" href="/inquiry">Send the inquiry form</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
