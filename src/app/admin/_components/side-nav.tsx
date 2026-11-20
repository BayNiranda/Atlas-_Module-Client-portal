"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ newCount, showTeam }: { newCount: number; showTeam: boolean }) {
  const path = usePathname();
  const links: [string, string][] = [
    ["/admin", "Dashboard"],
    ["/admin/inquiries", "Inquiries"],
    ["/admin/clients", "Clients"],
    ...(showTeam ? ([["/admin/team", "Team"]] as [string, string][]) : []),
  ];
  return (
    <nav aria-label="Admin">
      {links.map(([href, label]) => {
        const current = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={current ? "page" : undefined}>
            {label}
            {href === "/admin/inquiries" && newCount > 0 && <span className="ct" aria-label={`${newCount} new`}>{newCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
