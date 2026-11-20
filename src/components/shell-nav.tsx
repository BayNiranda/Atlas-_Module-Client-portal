"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number; exact?: boolean };

// Sidebar menu for the admin area and the client portal.
export function ShellNav({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label}>
      {items.map(({ href, label: text, count, exact }) => {
        const current = exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={current ? "page" : undefined}>
            {text}
            {!!count && <span className="ct" aria-label={`${count} new`}>{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
