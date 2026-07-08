import Link from "next/link";
import { getData } from "@/lib/data";
import StatTile from "@/components/StatTile";

export default function OverviewPage() {
  const data = getData();
  const totalCountries = data.inventory.length;
  const expired = data.inventory.filter((i) => i.status === "expired").length;
  const layer3Count = Object.keys(data.layer3Verified).length;

  const anyScore4 = data.matrix.filter((r) =>
    data.themeNames.some((t) => r.scores[t] === 4)
  ).length;
  const anyScore3Plus = data.matrix.filter((r) =>
    data.themeNames.some((t) => r.scores[t] >= 3)
  ).length;
  const noneAtAll = data.matrix.filter((r) =>
    data.themeNames.every((t) => r.scores[t] === 0)
  ).length;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Summary</h1>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          Theme-coding analysis of UNDP Country Programme Documents (CPDs) against
          Rule of Law, Security, Human Rights, Justice, Peacebuilding, Conflict
          Prevention, Local Action, Gender Justice / GEWE, and Leave No One Behind
          (LNOB) — cross-referenced with global IRRF Tier-2 indicator linkages.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Countries / CPDs" value={totalCountries} />
        <StatTile
          label="With dedicated ROLSHR-type result (score ≥ 3, any theme)"
          value={anyScore3Plus}
        />
        <StatTile
          label="With IRRF-tagged linkage (score = 4, any theme)"
          value={anyScore4}
        />
        <StatTile label="No theme mentions at all (all themes = 0)" value={noneAtAll} />
        <StatTile
          label="CPD end date already passed"
          value={expired}
          hint="May be extended / in renewal — see Inventory"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">What this covers — and what it doesn&rsquo;t</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div
            className="rounded-lg border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="font-semibold" style={{ color: "var(--good)" }}>
              Built from real, structured UNDP data
            </div>
            <p className="mt-2" style={{ color: "var(--ink-secondary)" }}>
              Two source files in <code>data/</code>: the CPD outcome and output result
              statements for {totalCountries} country programmes, each pre-tagged by UNDP
              with its Primary/Secondary/Tertiary IRRF Tier-2 linkage. No text was
              invented — every score traces back to a verbatim outcome/output
              description (see the Evidence tab).
            </p>
          </div>
          <div
            className="rounded-lg border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="font-semibold" style={{ color: "var(--warning)" }}>
              Important limitation
            </div>
            <p className="mt-2" style={{ color: "var(--ink-secondary)" }}>
              No raw CPD PDF documents were provided in this session — only the
              extracted outcome/output database. That means: (1) scores of{" "}
              <strong>1</strong> (&ldquo;context/background only&rdquo;) cannot be
              distinguished from the full CPD narrative (country context, theory of
              change) and are not assigned; (2) page numbers cannot be cited except
              for the {layer3Count} countries already deep-verified against source
              PDFs in <code>my-personal-study/Layer3_Final_Analysis.xlsx</code>{" "}
              (Mali, Syria, Burkina Faso, Haiti, Belarus, China, Myanmar,
              Afghanistan, Albania, Cuba) — those are carried through and flagged
              throughout this app.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Scoring rubric as actually applied</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                <th className="px-3 py-2 text-left font-medium">Score</th>
                <th className="px-3 py-2 text-left font-medium">Brief definition</th>
                <th className="px-3 py-2 text-left font-medium">How it&rsquo;s derived here</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["0", "No mention", "No theme keyword found in any outcome/output statement."],
                ["1", "Context/background only", "Not assessable — requires full CPD narrative text, not in this dataset."],
                ["2", "Cross-cutting / general strategy", "A weak/adjacent keyword appears in an outcome or output statement, but the result isn't dedicated to the theme."],
                ["3", "Dedicated outcome/output/programme area", "A strong theme keyword appears in a dedicated outcome or output statement, with no matching IRRF Tier-2 tag."],
                ["4", "Outcome/output + indicator/IRRF linkage", "Same as score 3, plus the result's IRRF Primary/Secondary/Tertiary tag matches the theme's mapped IRRF Tier-2 code(s)."],
              ].map(([s, d, h]) => (
                <tr key={s} className="border-t" style={{ borderColor: "var(--grid)" }}>
                  <td className="px-3 py-2 font-semibold tnum">{s}</td>
                  <td className="px-3 py-2" style={{ color: "var(--ink-secondary)" }}>{d}</td>
                  <td className="px-3 py-2" style={{ color: "var(--ink-secondary)" }}>{h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          Gender Justice / GEWE and LNOB are cross-cutting principles with no
          standalone IRRF Tier-2 output code in this dataset, so they can reach at
          most score 3 from tagging data alone — see the IRRF Linkage Review tab.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Where to go next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--ink-secondary)" }}>
          <li>
            <Link className="underline" href="/inventory">CPD Inventory</Link> — country,
            CPD period, current/expired status, missing data flags.
          </li>
          <li>
            <Link className="underline" href="/matrix">Theme Matrix</Link> — the 0–4
            country × theme heatmap.
          </li>
          <li>
            <Link className="underline" href="/evidence">Evidence</Link> — the
            underlying outcome/output text behind every score.
          </li>
          <li>
            <Link className="underline" href="/linkage">IRRF Linkage Review</Link> —
            per-theme tagging coverage, mirrors and extends the existing
            rule-of-law-only linkage analysis to all 9 themes.
          </li>
          <li>
            <Link className="underline" href="/review">Manual Review List</Link> —
            countries that discuss a theme but aren&rsquo;t tagged to a matching
            global indicator; candidates for country-office follow-up.
          </li>
        </ul>
      </section>
    </div>
  );
}
