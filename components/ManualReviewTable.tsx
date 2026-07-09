"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ManualReviewItem } from "@/lib/types";

export default function ManualReviewTable({
  items,
  themeNames,
}: {
  items: ManualReviewItem[];
  themeNames: string[];
}) {
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (theme && it.theme !== theme) return false;
      if (needle) {
        const hay = `${it.code} ${it.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, theme]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search country or code"
          placeholder="Search country or code…"
          className="rounded border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          aria-label="Filter by theme"
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <option value="">All themes</option>
          {themeNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {filtered.length} / {items.length} shown
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th className="px-3 py-2 text-left font-medium">Country</th>
              <th className="px-3 py-2 text-left font-medium">Theme</th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
              <th className="px-3 py-2 text-left font-medium">Sample evidence</th>
              <th className="px-3 py-2 text-left font-medium">Layer-3 status</th>
              <th className="px-3 py-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, idx) => (
              <tr key={idx} className="border-t align-top" style={{ borderColor: "var(--grid)" }}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {it.name ?? it.code}{" "}
                  <span className="font-mono text-xs" style={{ color: "var(--ink-muted)" }}>
                    {it.code}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{it.theme}</td>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--ink-muted)" }}>
                  {it.resultName}
                </td>
                <td className="px-3 py-2 max-w-md" style={{ color: "var(--ink-secondary)" }}>
                  {it.sampleEvidence}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: it.layer3Category ? "var(--good)" : "var(--ink-muted)" }}>
                  {it.layer3Category ?? "Not yet verified"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    className="text-xs underline"
                    href={`/evidence?code=${encodeURIComponent(it.code)}&theme=${encodeURIComponent(it.theme)}`}
                  >
                    View evidence
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
