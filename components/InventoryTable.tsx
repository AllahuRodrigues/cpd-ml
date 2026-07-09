"use client";

import { useMemo, useState } from "react";
import type { InventoryItem } from "@/lib/types";

type StatusFilter = "all" | "active" | "expired" | "unknown";

export default function InventoryTable({ items }: { items: InventoryItem[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyLayer3, setOnlyLayer3] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (status !== "all" && it.status !== status) return false;
      if (onlyMissing && it.missing.length === 0) return false;
      if (onlyLayer3 && !it.layer3Category) return false;
      if (needle) {
        const hay = `${it.code} ${it.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, status, onlyMissing, onlyLayer3]);

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
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by CPD status"
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active per data</option>
          <option value="expired">End date passed</option>
          <option value="unknown">Unknown</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Missing data only
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyLayer3} onChange={(e) => setOnlyLayer3(e.target.checked)} />
          Layer-3 verified only
        </label>
        <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {filtered.length} / {items.length} shown
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Code</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Country / CPD name</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">CPD period</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">SP cycle</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Status</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Outcomes</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Outputs</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Missing / flags</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Layer-3 verification</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.code} className="border-t align-top" style={{ borderColor: "var(--grid)" }}>
                <td className="px-3 py-2 font-mono text-xs">{it.code}</td>
                <td className="px-3 py-2">{it.name ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap tnum">
                  {it.cpdStart ?? "?"} &rarr; {it.cpdEnd ?? "?"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{it.spCycle ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={it.status} />
                </td>
                <td className="px-3 py-2 text-right tnum">{it.nOutcomes}</td>
                <td className="px-3 py-2 text-right tnum">{it.nOutputs}</td>
                <td className="px-3 py-2" style={{ color: "var(--serious)" }}>
                  {it.missing.length > 0 ? it.missing.join("; ") : ""}
                </td>
                <td className="px-3 py-2 max-w-xs" style={{ color: "var(--ink-secondary)" }}>
                  {it.layer3Category ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InventoryItem["status"] }) {
  const map: Record<InventoryItem["status"], { label: string; color: string }> = {
    active: { label: "Active per data", color: "var(--good)" },
    expired: { label: "End date passed", color: "var(--warning)" },
    unknown: { label: "Unknown", color: "var(--ink-muted)" },
  };
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
