import { getData } from "@/lib/data";
import Link from "next/link";

export default function LinkagePage() {
  const data = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IRRF Linkage Review</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          Per theme, how many countries land in each score bucket. This extends
          the existing rule-of-law-only linkage analysis (in{" "}
          <code>my-personal-study/CPD_IRRF_Linkage_Analysis.xlsx</code>) to all 9
          themes using the same tagging logic: score 4 requires both a theme
          keyword match <em>and</em> a matching IRRF Tier-2 code.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th className="px-3 py-2 text-left font-medium">Theme</th>
              <th className="px-3 py-2 text-left font-medium">Mapped IRRF Tier-2 code(s)</th>
              <th className="px-3 py-2 text-right font-medium tnum">4: tagged</th>
              <th className="px-3 py-2 text-right font-medium tnum">3: untagged mention</th>
              <th className="px-3 py-2 text-right font-medium tnum">2: cross-cutting only</th>
              <th className="px-3 py-2 text-right font-medium tnum">0: no mention</th>
              <th className="px-3 py-2 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {data.linkageReview.map((lr) => (
              <tr key={lr.theme} className="border-t" style={{ borderColor: "var(--grid)" }}>
                <td className="px-3 py-2 font-medium">
                  <Link className="underline" href={`/evidence?theme=${encodeURIComponent(lr.theme)}`}>
                    {lr.theme}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-secondary)" }}>
                  {lr.mappedIrrfCodes.length > 0
                    ? lr.mappedIrrfCodes.map((c) => c.replace("IRRF Tier 2 - ", "")).join("; ")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tnum">{lr.countScore4}</td>
                <td className="px-3 py-2 text-right tnum">{lr.countScore3}</td>
                <td className="px-3 py-2 text-right tnum">{lr.countScore2}</td>
                <td className="px-3 py-2 text-right tnum">{lr.countScore0}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "var(--warning)" }}>
                  {lr.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
        &ldquo;3: untagged mention&rdquo; is the strongest underreporting signal —
        a dedicated outcome/output exists but isn&rsquo;t reflected in the global
        IRRF tagging. See the Manual Review List for the country-level detail.
      </p>
    </div>
  );
}
