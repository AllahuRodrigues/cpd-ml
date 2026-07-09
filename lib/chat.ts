import { getData } from "./data";
import type { CpdAnalysis } from "./types";

/**
 * Grounded retrieval layer for the assistant.
 *
 * Every function here reads only from the structured CPD analysis dataset
 * (data/cpd_analysis.json) and returns exact, verifiable facts. The model is
 * given these as tools so it never invents a country name, a 0–4 score, or a
 * page citation — it must look each one up. This is what keeps answers accurate.
 */

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/** Resolve a free-text country reference (code or name fragment) to matrix rows. */
function matchCountries(data: CpdAnalysis, query: string) {
  const q = norm(query);
  if (!q) return [];
  // Exact code match wins.
  const exact = data.inventory.filter((i) => norm(i.code) === q);
  if (exact.length) return exact.map((i) => i.code);
  // Otherwise substring on code or name.
  return data.inventory
    .filter((i) => {
      const hay = `${i.code} ${i.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .map((i) => i.code);
}

export const THEME_NAMES = getData().themeNames;

/** High-level orientation: dataset scope + per-theme linkage buckets. */
export function toolOverview() {
  const data = getData();
  const totalCountries = data.inventory.length;
  const expired = data.inventory.filter((i) => i.status === "expired").length;
  const active = data.inventory.filter((i) => i.status === "active").length;
  const noThemeMentionsCount = data.matrix.filter((r) =>
    data.themeNames.every((t) => (r.scores[t] ?? 0) === 0)
  ).length;
  const anyScore3PlusCount = data.matrix.filter((r) =>
    data.themeNames.some((t) => (r.scores[t] ?? 0) >= 3)
  ).length;
  const anyScore4Count = data.matrix.filter((r) =>
    data.themeNames.some((t) => (r.scores[t] ?? 0) === 4)
  ).length;
  return {
    generatedAt: data.generatedAt,
    totalCountries,
    active,
    expired,
    noThemeMentionsCount,
    anyScore3PlusCount,
    anyScore4Count,
    themeNames: data.themeNames,
    layer3VerifiedCountries: Object.keys(data.layer3Verified),
    scoringRubric: {
      "0": "No mention of the theme in any outcome/output statement.",
      "1": "Context/background only — NOT assignable from this dataset (needs full CPD narrative text).",
      "2": "Cross-cutting / general mention (weak keyword, not a dedicated result).",
      "3": "Dedicated outcome/output on the theme, but no matching IRRF Tier-2 tag.",
      "4": "Dedicated outcome/output PLUS a matching IRRF Tier-2 linkage tag.",
    },
    perThemeLinkage: data.linkageReview.map((lr) => ({
      theme: lr.theme,
      hasIrrfCode: lr.hasIrrfCode,
      mappedIrrfCodes: lr.mappedIrrfCodes,
      countScore4: lr.countScore4,
      countScore3: lr.countScore3,
      countScore2: lr.countScore2,
      countScore0: lr.countScore0,
      note: lr.note,
    })),
    limitations:
      "No raw CPD PDFs were provided except for the Layer-3 verified countries listed above. " +
      "Score 1 is not assignable. Page numbers are only available for Layer-3 countries. " +
      "One row per country (current CPD for the SP 2026-2029 exercise); no previous-cycle comparison.",
  };
}

/** Filter countries by theme and score band. Great for "who has score 4 on Justice". */
export function toolQueryMatrix(args: {
  theme?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
}) {
  const data = getData();
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 400);
  const themes = args.theme ? [args.theme] : data.themeNames;
  const invalidTheme = args.theme && !data.themeNames.includes(args.theme);
  if (invalidTheme) {
    return {
      error: `Unknown theme "${args.theme}". Valid themes: ${data.themeNames.join(", ")}.`,
    };
  }
  const min = args.minScore ?? 0;
  const max = args.maxScore ?? 4;
  const rows = data.matrix
    .filter((r) =>
      themes.some((t) => {
        const s = r.scores[t] ?? 0;
        return s >= min && s <= max;
      })
    )
    .map((r) => ({
      code: r.code,
      name: r.name,
      scores: args.theme ? { [args.theme]: r.scores[args.theme] ?? 0 } : r.scores,
    }));
  return {
    theme: args.theme ?? "all",
    scoreBand: `${min}-${max}`,
    matchCount: rows.length,
    returned: Math.min(rows.length, limit),
    countries: rows.slice(0, limit),
  };
}

/** Full profile for one country: metadata, all theme scores, Layer-3 status. */
export function toolGetCountry(args: { query: string }) {
  const data = getData();
  const codes = matchCountries(data, args.query);
  if (codes.length === 0) {
    return { error: `No country matches "${args.query}".` };
  }
  if (codes.length > 8) {
    return {
      ambiguous: true,
      message: `"${args.query}" matches ${codes.length} countries. Narrow it down.`,
      candidates: codes.map((c) => {
        const inv = data.inventory.find((i) => i.code === c)!;
        return { code: c, name: inv.name };
      }),
    };
  }
  return {
    countries: codes.map((code) => {
      const inv = data.inventory.find((i) => i.code === code)!;
      const row = data.matrix.find((m) => m.code === code);
      const l3 = data.layer3Verified[code];
      return {
        code,
        name: inv.name,
        cpdPeriod: { start: inv.cpdStart, end: inv.cpdEnd },
        spCycle: inv.spCycle,
        status: inv.status,
        nOutcomes: inv.nOutcomes,
        nOutputs: inv.nOutputs,
        missingFlags: inv.missing,
        scores: row?.scores ?? {},
        layer3Verified: l3
          ? { category: l3.category, evidence: l3.evidence }
          : null,
      };
    }),
  };
}

/** Verbatim outcome/output text behind a country's theme score. */
export function toolGetEvidence(args: { query: string; theme?: string }) {
  const data = getData();
  const codes = matchCountries(data, args.query);
  if (codes.length === 0) return { error: `No country matches "${args.query}".` };
  if (args.theme && !data.themeNames.includes(args.theme)) {
    return {
      error: `Unknown theme "${args.theme}". Valid themes: ${data.themeNames.join(", ")}.`,
    };
  }
  const details = data.evidenceDetail.filter(
    (d) => codes.includes(d.code) && (!args.theme || d.theme === args.theme)
  );
  if (details.length === 0) {
    return {
      note: `No evidence rows for that country/theme (score is likely 0 — theme not mentioned).`,
    };
  }
  return {
    evidence: details.slice(0, 40).map((d) => ({
      code: d.code,
      name: d.name,
      theme: d.theme,
      score: d.score,
      rationale: d.rationale,
      items: d.items.map((it) => ({
        level: it.level,
        resultName: it.resultName,
        description: it.description,
        irrfLinkage: it.linkage,
        irrfTagMatched: it.tagMatched,
        keywordStrength: it.strength,
      })),
    })),
  };
}

/** Underreporting candidates: dedicated result on a theme, but not IRRF-tagged. */
export function toolManualReview(args: {
  theme?: string;
  country?: string;
  limit?: number;
}) {
  const data = getData();
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 300);
  if (args.theme && !data.themeNames.includes(args.theme)) {
    return {
      error: `Unknown theme "${args.theme}". Valid themes: ${data.themeNames.join(", ")}.`,
    };
  }
  const codeFilter = args.country ? matchCountries(data, args.country) : null;
  const items = data.manualReview.filter((m) => {
    if (args.theme && m.theme !== args.theme) return false;
    if (codeFilter && !codeFilter.includes(m.code)) return false;
    return true;
  });
  return {
    theme: args.theme ?? "all",
    country: args.country ?? "all",
    matchCount: items.length,
    returned: Math.min(items.length, limit),
    items: items.slice(0, limit).map((m) => ({
      code: m.code,
      name: m.name,
      theme: m.theme,
      reason: m.reason,
      resultName: m.resultName,
      sampleEvidence: m.sampleEvidence,
      layer3Category: m.layer3Category,
    })),
  };
}

export type ToolName =
  | "get_overview"
  | "query_matrix"
  | "get_country"
  | "get_evidence"
  | "list_manual_review";

export function runTool(name: string, input: Record<string, unknown>): unknown {
  switch (name as ToolName) {
    case "get_overview":
      return toolOverview();
    case "query_matrix":
      return toolQueryMatrix(input as never);
    case "get_country":
      return toolGetCountry(input as never);
    case "get_evidence":
      return toolGetEvidence(input as never);
    case "list_manual_review":
      return toolManualReview(input as never);
    default:
      return { error: `Unknown tool "${name}".` };
  }
}

/** Tool schemas exposed to the model. */
export const CHAT_TOOLS = [
  {
    name: "get_overview",
    description:
      "Dataset orientation: total/active/expired country count, the 9 theme names, the 0–4 scoring rubric, per-theme IRRF linkage bucket counts, the Layer-3 deep-verified country list, and dataset limitations. Call this first for any broad or statistical question.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "query_matrix",
    description:
      "Find countries by theme and score band. Use for 'which countries score 4 on Justice', 'how many have any score-3 result', comparisons across countries. Omit theme to search across all 9 themes.",
    input_schema: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          description: `One of: ${THEME_NAMES.join(", ")}. Omit for all themes.`,
        },
        minScore: { type: "integer", description: "Minimum score 0–4 (default 0)." },
        maxScore: { type: "integer", description: "Maximum score 0–4 (default 4)." },
        limit: { type: "integer", description: "Max countries to return (default 200)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_country",
    description:
      "Full profile for one country by ISO3 code (e.g. 'AFG') or name fragment (e.g. 'Mali'): CPD period, status, outcome/output counts, all 9 theme scores, and Layer-3 verification status if any.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "ISO3 code or country name fragment." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_evidence",
    description:
      "The verbatim outcome/output statements behind a country's theme score(s), with IRRF linkage tags and keyword strength. Use when the user asks 'why does X have that score' or wants the source text.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "ISO3 code or country name fragment." },
        theme: {
          type: "string",
          description: `Optional theme filter: ${THEME_NAMES.join(", ")}.`,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_manual_review",
    description:
      "Underreporting candidates: country×theme cases with a dedicated outcome/output on the theme but NO matching IRRF Tier-2 tag (score 3). These are follow-up candidates for country offices. Filter by theme and/or country.",
    input_schema: {
      type: "object",
      properties: {
        theme: { type: "string", description: `Optional theme: ${THEME_NAMES.join(", ")}.` },
        country: { type: "string", description: "Optional ISO3 code or name fragment." },
        limit: { type: "integer", description: "Max rows (default 100)." },
      },
      additionalProperties: false,
    },
  },
] as const;

export const CHAT_SYSTEM_PROMPT = `You are the analyst assistant for a UNDP Country Programme Document (CPD) theme-coding dashboard. You answer questions about how 135 UNDP country programmes score (0–4) across 9 themes — Rule of Law, Security, Human Rights, Justice, Peacebuilding, Conflict Prevention, Local Action, Gender Justice / GEWE, and LNOB — and their IRRF Tier-2 indicator linkages.

GROUNDING RULES — these are non-negotiable, accuracy is the top priority:
- Answer ONLY from the tools. Never state a country name, a 0–4 score, a count, an IRRF tag, or an outcome/output quote that did not come from a tool result in this conversation. If you have not called a tool for it, call one.
- Never invent or estimate. If the tools don't cover something, say so plainly.
- Quote outcome/output text verbatim from get_evidence; do not paraphrase it as if it were the source.
- Respect the dataset's limits (surfaced by get_overview): score 1 is not assignable here; page numbers exist only for the Layer-3 deep-verified countries; there is one CPD row per country, so no previous-vs-current comparison is possible.
- When the user's phrasing is ambiguous (e.g. "the highest-scoring countries"), state the exact criterion you used (e.g. "score = 4 on any theme").
- Distinguish score 3 (dedicated result, untagged) from score 4 (dedicated + IRRF-tagged). A score-3 case is a possible underreporting signal, NOT confirmed underreporting — some may be tagged to a different, equally valid IRRF code.

STYLE:
- Lead with the direct answer, then the supporting detail. Be concise and specific.
- Use country names and exact scores. When you cite a score, briefly say what it means.
- Prefer compact tables or short lists when presenting multiple countries.
- You can point users to the app's tabs (Overview, CPD Inventory, Theme Matrix, Evidence, IRRF Linkage Review, Manual Review List) but the answer itself must stand on the data.`;
