"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EvidenceDetail, InventoryItem } from "@/lib/types";
import ScoreCell from "./ScoreCell";

export default function EvidenceExplorer({
  details,
  inventory,
  themeNames,
  initialCode,
  initialTheme,
}: {
  details: EvidenceDetail[];
  inventory: InventoryItem[];
  themeNames: string[];
  initialCode: string;
  initialTheme: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [theme, setTheme] = useState(initialTheme);

  const countryOptions = useMemo(
    () =>
      [...inventory]
        .sort((a, b) => (a.name ?? a.code).localeCompare(b.name ?? b.code))
        .map((i) => ({ code: i.code, name: i.name ?? i.code })),
    [inventory]
  );

  function update(nextCode: string, nextTheme: string) {
    setCode(nextCode);
    setTheme(nextTheme);
    const params = new URLSearchParams();
    if (nextCode) params.set("code", nextCode);
    if (nextTheme) params.set("theme", nextTheme);
    router.replace(`/evidence${params.toString() ? `?${params}` : ""}`);
  }

  const filtered = useMemo(() => {
    if (!code && !theme) return [];
    return details.filter((d) => {
      if (code && d.code !== code) return false;
      if (theme && d.theme !== theme) return false;
      return true;
    });
  }, [details, code, theme]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={code}
          onChange={(e) => update(e.target.value, theme)}
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <option value="">All countries</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={theme}
          onChange={(e) => update(code, e.target.value)}
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
        {(code || theme) && (
          <button
            onClick={() => update("", "")}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            Clear
          </button>
        )}
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {filtered.length} theme×country matches with at least one mention
        </span>
      </div>

      {filtered.length === 0 && (code || theme) && (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          No mentions found for this filter — the theme most likely scored 0 for
          this country.
        </p>
      )}
      {!code && !theme && (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Pick a country and/or theme above to see the underlying outcome/output
          text ({details.length} theme×country combinations have at least one
          mention across all {inventory.length} countries).
        </p>
      )}

      <div className="space-y-4">
        {filtered.map((d) => (
          <div
            key={`${d.code}-${d.theme}`}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{d.name ?? d.code}</span>{" "}
                <span className="font-mono text-xs" style={{ color: "var(--ink-muted)" }}>
                  {d.code}
                </span>
                <span className="mx-2" style={{ color: "var(--ink-muted)" }}>
                  &middot;
                </span>
                <span>{d.theme}</span>
              </div>
              <div className="flex items-center gap-2">
                <ScoreCell score={d.score} />
                <span className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                  {d.rationale}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {d.items.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--grid)" }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--ink-muted)" }}>
                    <span className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                      {it.level}
                    </span>
                    <span className="font-mono">{it.resultName}</span>
                    <span
                      className="rounded px-1.5 py-0.5"
                      style={{
                        background: it.strength === "strong" ? "var(--score-3)" : "transparent",
                        color: it.strength === "strong" ? "var(--score-3-ink)" : "var(--ink-muted)",
                        border: it.strength === "strong" ? "none" : "1px dashed var(--grid)",
                      }}
                    >
                      {it.strength} match
                    </span>
                    {it.tagMatched && (
                      <span className="rounded px-1.5 py-0.5" style={{ background: "var(--score-4)", color: "var(--score-4-ink)" }}>
                        IRRF-tagged
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5">{it.description}</p>
                  {it.linkage && (
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                      Linkage: {it.linkage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
