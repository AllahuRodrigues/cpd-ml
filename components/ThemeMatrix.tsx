"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MatrixRow } from "@/lib/types";
import ScoreCell from "./ScoreCell";

export default function ThemeMatrix({
  rows,
  themeNames,
}: {
  rows: MatrixRow[];
  themeNames: string[];
}) {
  const [q, setQ] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [minScore, setMinScore] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.code} ${r.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const scores = themeNames.map((t) => r.scores[t]);
      if (hideEmpty && scores.every((s) => s === 0)) return false;
      if (minScore > 0 && !scores.some((s) => s >= minScore)) return false;
      return true;
    });
  }, [rows, q, hideEmpty, minScore, themeNames]);

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
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Hide rows with no theme mentions
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Min score
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <option value={0}>Any</option>
            <option value={2}>≥ 2</option>
            <option value={3}>≥ 3</option>
            <option value={4}>= 4</option>
          </select>
        </label>
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {filtered.length} / {rows.length} shown · click a cell for evidence
        </span>
      </div>

      <Legend />

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th
                className="sticky left-0 whitespace-nowrap px-3 py-2 text-left font-medium"
                style={{ background: "var(--surface)" }}
              >
                Country
              </th>
              {themeNames.map((t) => (
                <th key={t} className="px-2 py-2 text-center font-medium" style={{ minWidth: 64 }}>
                  <span className="block max-w-[80px] leading-tight">{t}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.code} className="border-t" style={{ borderColor: "var(--grid)" }}>
                <td
                  className="sticky left-0 whitespace-nowrap px-3 py-1.5 font-medium"
                  style={{ background: "var(--page)" }}
                >
                  {r.name ?? r.code}{" "}
                  <span className="font-mono text-xs" style={{ color: "var(--ink-muted)" }}>
                    {r.code}
                  </span>
                </td>
                {themeNames.map((t) => (
                  <td key={t} className="px-2 py-1.5 text-center">
                    <Link
                      href={`/evidence?code=${encodeURIComponent(r.code)}&theme=${encodeURIComponent(t)}`}
                      className="inline-block"
                    >
                      <ScoreCell score={r.scores[t]} />
                    </Link>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend() {
  const items: [number, string][] = [
    [0, "No mention"],
    [2, "Cross-cutting / general mention"],
    [3, "Dedicated outcome/output, untagged"],
    [4, "Dedicated + IRRF-tagged"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--ink-secondary)" }}>
      {items.map(([s, label]) => (
        <span key={s} className="flex items-center gap-1.5">
          <ScoreCell score={s} />
          {label}
        </span>
      ))}
      <span style={{ color: "var(--ink-muted)" }}>(score 1 not assignable from this dataset — see Overview)</span>
    </div>
  );
}
