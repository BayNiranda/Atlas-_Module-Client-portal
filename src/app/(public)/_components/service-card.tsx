import Link from "next/link";
import type { Service } from "@/modules/services/queries";
import { ServiceIcon } from "./icons";

export function ServiceCard({ s }: { s: Service }) {
  return (
    <Link className="card3" href={`/services/${s.slug}`}>
      <div className="ic">
        <ServiceIcon slug={s.slug} />
      </div>
      <h3>{s.name}</h3>
      <div className="lo" lang="lo">{s.name_lo}</div>
      <p>{s.summary}</p>
      <span className="more">View service →</span>
    </Link>
  );
}
