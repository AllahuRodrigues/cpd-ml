"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/inventory", label: "CPD Inventory" },
  { href: "/matrix", label: "Theme Matrix" },
  { href: "/evidence", label: "Evidence" },
  { href: "/linkage", label: "IRRF Linkage Review" },
  { href: "/review", label: "Manual Review List" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <span className="text-sm font-semibold tracking-tight shrink-0">
            CPD &times; ROLSHR Theme Analysis
          </span>
          <nav aria-label="Primary" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className="rounded px-2 py-1 transition-colors"
                  style={{
                    color: active ? "var(--score-2-ink)" : "var(--ink-secondary)",
                    background: active ? "var(--score-2)" : "transparent",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
