"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/#how-we-work", "How we work"],
  ["/#faq", "FAQ"],
  ["/inquiry", "Contact"],
] as const;

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      {LINKS.map(([href, label]) => {
        const current = href === "/" ? path === "/" : !href.includes("#") && path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
