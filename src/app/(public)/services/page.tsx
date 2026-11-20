import type { Metadata } from "next";
import { getPublicServices } from "@/modules/services/queries";
import { PageHead } from "../_components/page-head";
import { ServiceCard } from "../_components/service-card";

export const metadata: Metadata = { title: "Services · Atlas Advisory" };

export default async function ServicesPage() {
  const services = await getPublicServices();
  return (
    <>
      <PageHead
        top={<span className="pill"><i />Services · ບໍລິການ</span>}
        title="Our services"
        lao="ບໍລິການຂອງພວກເຮົາ"
        sub="Choose a service to see what is included, who it is for and what you receive."
      />
      <section className="sec3">
        <div className="wrap">
          <div className="svc3">{services.map((s) => <ServiceCard key={s.slug} s={s} />)}</div>
        </div>
      </section>
    </>
  );
}
