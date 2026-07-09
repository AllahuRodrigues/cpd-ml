import {
  toolOverview,
  toolQueryMatrix,
  toolGetCountry,
  toolGetEvidence,
  toolManualReview,
  THEME_NAMES,
} from "../chat";
import { GLOSSARY } from "./lexicon";
import { normalize } from "./text";
import {
  resolveCountries,
  resolveSingleTheme,
  resolveScoreBand,
  resolveLimit,
  bareNameForCode,
  type CountryMatch,
} from "./entities";
import { classifyIntent, type ParsedEntities } from "./intent";
import { deriveContext } from "./context";

export interface NlpAnswer {
  text: string;
  toolsUsed: string[];
}

type Msg = { role: "user" | "assistant"; content: string };

const DEFAULT_LIST_CAP = 20;
const DEFAULT_REVIEW_CAP = 15;

function scoreLabel(n: number): string {
  switch (n) {
    case 0:
      return "no mention";
    case 1:
      return "context only (not assignable)";
    case 2:
      return "cross-cutting mention";
    case 3:
      return "dedicated, untagged";
    case 4:
      return "dedicated + IRRF-tagged";
    default:
      return String(n);
  }
}

function truncate(s: string, max = 600): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}

const HELP_TEXT = `I answer questions about the 135 UNDP country programmes in this dataset — 9 themes, 0–4 scores, IRRF linkages. I look everything up from the structured data (no guessing), so try things like:

• "Which countries score 4 on Justice?"
• "Tell me about Mali" / "MLI"
• "Why does Syria score that way on Human Rights?"
• "Compare Mali and Kenya"
• "Underreporting on Human Rights" (manual-review gaps)
• "How many countries have no theme mentions at all?"
• "What does score 3 mean?" / "What is IRRF?"

I remember the country/theme from your last question, so follow-ups like "what about Kenya?" work too.`;

function clarifyNoCountry(): NlpAnswer {
  return {
    text:
      "I need a country to answer that — give me an ISO3 code (e.g. AFG, MLI) or a name (e.g. Afghanistan, Mali).",
    toolsUsed: [],
  };
}

function clarifyNoTheme(): NlpAnswer {
  return {
    text: `Which theme? Valid themes: ${THEME_NAMES.join(", ")}.`,
    toolsUsed: [],
  };
}

function clarifyThemeAmbiguous(candidates: string[]): NlpAnswer {
  return {
    text: `That could mean ${candidates.join(" or ")} — which one did you mean?`,
    toolsUsed: [],
  };
}

function clarifyUnknown(): NlpAnswer {
  return {
    text:
      "I'm not sure what you're asking — could you rephrase? " + HELP_TEXT,
    toolsUsed: [],
  };
}

function formatOverview(): { text: string; data: ReturnType<typeof toolOverview> } {
  const o = toolOverview();
  const layer3List = o.layer3VerifiedCountries.join(", ");
  const text = [
    `This dataset covers ${o.totalCountries} UNDP country programmes (${o.active} active per their listed CPD end date, ${o.expired} past that date — often mid-renewal, not necessarily lapsed).`,
    `Across the 9 themes — ${o.themeNames.join(", ")} — ${o.anyScore4Count} countries have at least one dedicated + IRRF-tagged result (score 4 on some theme), ${o.anyScore3PlusCount} have at least one dedicated result (score ≥ 3 on some theme), and ${o.noThemeMentionsCount} have no theme mentions at all across all 9 themes.`,
    `Scoring rubric: 0 = no mention · 1 = context only, not assignable from this dataset · 2 = cross-cutting mention · 3 = dedicated outcome/output, untagged · 4 = dedicated + IRRF-tagged.`,
    `${o.layer3VerifiedCountries.length} countries are Layer-3 deep-verified against source CPD PDFs: ${layer3List}.`,
    o.limitations,
  ].join("\n\n");
  return { text, data: o };
}

function formatThemeSummary(theme: string): string {
  const o = toolOverview();
  const lr = o.perThemeLinkage.find((l) => l.theme === theme);
  if (!lr) return `No linkage data found for "${theme}".`;
  const codes = lr.mappedIrrfCodes.length
    ? lr.mappedIrrfCodes.map((c) => c.replace("IRRF Tier 2 - ", "")).join("; ")
    : "no mapped IRRF Tier-2 code — this theme can reach at most score 3 from tagging data alone";
  const note = lr.note ? ` ${lr.note}` : "";
  return [
    `**${theme}**`,
    `${lr.countScore4} countries score 4 (dedicated + IRRF-tagged, via ${codes}).`,
    `${lr.countScore3} score 3 (dedicated outcome/output, but untagged — the strongest underreporting signal).`,
    `${lr.countScore2} score 2 (cross-cutting mention only). ${lr.countScore0} score 0 (no mention).${note}`,
    `Ask "which countries score 4 on ${theme}" (or 3, or 2) for the full list.`,
  ].join("\n");
}

function formatCountryProfile(target: CountryMatch): NlpAnswer {
  const result = toolGetCountry({ query: target.code }) as {
    error?: string;
    ambiguous?: boolean;
    message?: string;
    candidates?: { code: string; name: string | null }[];
    countries?: Array<{
      code: string;
      name: string | null;
      cpdPeriod: { start: string | null; end: string | null };
      spCycle: string | null;
      status: string;
      nOutcomes: number;
      nOutputs: number;
      missingFlags: string[];
      scores: Record<string, number>;
      layer3Verified: { category: string; evidence: string } | null;
    }>;
  };

  if (result.error) return { text: result.error, toolsUsed: ["get_country"] };
  if (result.ambiguous) {
    const list = (result.candidates ?? [])
      .map((c) => `${c.name ?? c.code} (${c.code})`)
      .join(", ");
    return {
      text: `${result.message} Candidates: ${list}.`,
      toolsUsed: ["get_country"],
    };
  }

  const c = result.countries?.[0];
  if (!c) return { text: `No profile found for "${target.name}".`, toolsUsed: ["get_country"] };

  const scoreLines = Object.entries(c.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([theme, s]) => `  ${theme}: ${s} (${scoreLabel(s)})`)
    .join("\n");

  const parts = [
    `**${bareNameForCode(c.code)}** (${c.code}) — CPD ${c.cpdPeriod.start ?? "?"} → ${c.cpdPeriod.end ?? "?"}, ${c.spCycle ?? "SP cycle unknown"}, status: ${c.status}.`,
    `${c.nOutcomes} outcomes / ${c.nOutputs} outputs.`,
    `Theme scores:\n${scoreLines}`,
  ];
  if (c.layer3Verified) {
    parts.push(`Layer-3 verified: ${c.layer3Verified.category} — ${c.layer3Verified.evidence}`);
  }
  if (c.missingFlags.length) {
    parts.push(`Flags: ${c.missingFlags.join("; ")}`);
  }
  return { text: parts.join("\n\n"), toolsUsed: ["get_country"] };
}

function formatCompare(a: CountryMatch, b: CountryMatch): NlpAnswer {
  const ra = toolGetCountry({ query: a.code }) as ReturnType<typeof toolGetCountry> & {
    countries?: Array<{ name: string | null; scores: Record<string, number> }>;
  };
  const rb = toolGetCountry({ query: b.code }) as ReturnType<typeof toolGetCountry> & {
    countries?: Array<{ name: string | null; scores: Record<string, number> }>;
  };
  const ca = ra.countries?.[0];
  const cb = rb.countries?.[0];
  if (!ca || !cb) {
    return {
      text: `Couldn't load one of those countries for comparison — try exact ISO3 codes.`,
      toolsUsed: ["get_country"],
    };
  }
  const nameA = bareNameForCode(a.code);
  const nameB = bareNameForCode(b.code);
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  const lines = THEME_NAMES.map((t) => {
    const sa = ca.scores[t] ?? 0;
    const sb = cb.scores[t] ?? 0;
    if (sa > sb) aWins++;
    else if (sb > sa) bWins++;
    else ties++;
    return `  ${t} — ${nameA}: ${sa} · ${nameB}: ${sb}`;
  }).join("\n");

  const takeaway =
    aWins === bWins
      ? `Tied overall (${aWins} themes each, ${ties} equal).`
      : aWins > bWins
        ? `${nameA} scores higher on more themes (${aWins} vs ${bWins}, ${ties} equal).`
        : `${nameB} scores higher on more themes (${bWins} vs ${aWins}, ${ties} equal).`;

  return {
    text: `**${nameA} (${a.code})** vs **${nameB} (${b.code})**\n\n${lines}\n\n${takeaway}`,
    toolsUsed: ["get_country"],
  };
}

function formatEvidence(target: CountryMatch, theme: string | null): NlpAnswer {
  const result = toolGetEvidence({ query: target.code, theme: theme ?? undefined }) as {
    error?: string;
    note?: string;
    evidence?: Array<{
      code: string;
      name: string | null;
      theme: string;
      score: number;
      rationale: string;
      items: Array<{
        level: string;
        resultName: string | null;
        description: string | null;
        irrfLinkage: string;
        irrfTagMatched: boolean;
        keywordStrength: string;
      }>;
    }>;
  };
  if (result.error) return { text: result.error, toolsUsed: ["get_evidence"] };
  if (result.note) {
    return {
      text: `${target.name} (${target.code})${theme ? ` on ${theme}` : ""}: ${result.note}`,
      toolsUsed: ["get_evidence"],
    };
  }
  const blocks = (result.evidence ?? []).map((d) => {
    const itemLines = d.items
      .map((it) => {
        const linkage = it.irrfLinkage && it.irrfLinkage !== "" ? it.irrfLinkage : "no IRRF tag";
        return `  • [${it.level}${it.resultName ? ` — ${it.resultName}` : ""}] "${truncate(it.description ?? "")}"\n    IRRF linkage: ${linkage} (${it.irrfTagMatched ? "tag matched" : "not matched"}, ${it.keywordStrength} keyword)`;
      })
      .join("\n");
    return `**${bareNameForCode(d.code)} — ${d.theme}** — score ${d.score} (${scoreLabel(d.score)})\n${d.rationale}\n${itemLines}`;
  });
  return { text: blocks.join("\n\n"), toolsUsed: ["get_evidence"] };
}

function formatManualReview(theme: string | null, country: CountryMatch | null, limit: number | null): NlpAnswer {
  const result = toolManualReview({
    theme: theme ?? undefined,
    country: country?.code,
    limit: limit ?? 200,
  }) as {
    error?: string;
    matchCount: number;
    returned: number;
    items: Array<{
      code: string;
      name: string | null;
      theme: string;
      reason: string;
      resultName: string | null;
      layer3Category: string | null;
    }>;
  };
  if (result.error) return { text: result.error, toolsUsed: ["list_manual_review"] };
  if (result.matchCount === 0) {
    return {
      text: `No manual-review (dedicated-but-untagged) cases match${theme ? ` for ${theme}` : ""}${country ? ` in ${country.name}` : ""}.`,
      toolsUsed: ["list_manual_review"],
    };
  }
  const cap = limit ?? DEFAULT_REVIEW_CAP;
  const shown = result.items.slice(0, cap);
  const lines = shown
    .map((m) => {
      const l3 = m.layer3Category ? ` [Layer-3: ${m.layer3Category}]` : "";
      return `• ${bareNameForCode(m.code)} (${m.code}) — ${m.theme}: ${m.reason}${l3}`;
    })
    .join("\n");
  const more = result.matchCount > shown.length ? `\n\n+${result.matchCount - shown.length} more — narrow by theme or country, or see the Manual Review List tab.` : "";
  return {
    text: `${result.matchCount} country×theme case(s) with a dedicated result but no matching IRRF tag${theme ? ` on ${theme}` : ""}${country ? ` for ${country.name}` : ""} — a possible underreporting signal, not confirmed underreporting:\n\n${lines}${more}`,
    toolsUsed: ["list_manual_review"],
  };
}

function formatMatrixQuery(
  theme: string | null,
  band: { min: number; max: number; label: string } | null,
  limit: number | null
): NlpAnswer {
  const min = band?.min ?? 0;
  const max = band?.max ?? 4;
  const result = toolQueryMatrix({
    theme: theme ?? undefined,
    minScore: min,
    maxScore: max,
    limit: limit ?? 400,
  }) as {
    error?: string;
    matchCount: number;
    countries: Array<{ code: string; name: string | null; scores: Record<string, number> }>;
  };
  if (result.error) return { text: result.error, toolsUsed: ["query_matrix"] };

  const bandLabel = band?.label ?? "any score";
  if (result.matchCount === 0) {
    return {
      text: `No countries match ${theme ?? "any theme"} ${bandLabel}.`,
      toolsUsed: ["query_matrix"],
    };
  }

  const cap = limit ?? DEFAULT_LIST_CAP;
  const shown = result.countries.slice(0, cap);
  const lines = shown
    .map((c) => {
      const entries = Object.entries(c.scores).filter(([, s]) => s >= min && s <= max);
      const detail = entries.map(([t, s]) => `${t}: ${s}`).join(", ");
      return `• ${bareNameForCode(c.code)} (${c.code}) — ${detail}`;
    })
    .join("\n");
  const more =
    result.matchCount > shown.length
      ? `\n\n+${result.matchCount - shown.length} more — ask for "top N" or narrow the score band, or see the Theme Matrix tab.`
      : "";

  return {
    text: `${result.matchCount} countries match ${theme ?? "any theme"} ${bandLabel}:\n\n${lines}${more}`,
    toolsUsed: ["query_matrix"],
  };
}

function formatDefine(text: string): NlpAnswer {
  const n = normalize(text);
  if (n.includes("irrf")) return { text: GLOSSARY.irrf, toolsUsed: [] };
  if (n.includes("lnob") || n.includes("leave no one behind")) {
    return { text: GLOSSARY.lnob, toolsUsed: [] };
  }
  if (n.includes("gewe")) return { text: GLOSSARY.gewe, toolsUsed: [] };
  if (n.includes("rolshr")) return { text: GLOSSARY.rolshr, toolsUsed: [] };
  const band = resolveScoreBand(text);
  if (band && band.min === band.max) {
    return { text: `Score ${band.min} = ${scoreLabel(band.min)}.`, toolsUsed: [] };
  }
  if (n.includes("score")) {
    return {
      text: [
        "Score 0 = no mention.",
        "Score 1 = context/background only — not assignable from this dataset.",
        "Score 2 = cross-cutting / general mention.",
        "Score 3 = dedicated outcome or output on the theme, but no matching IRRF Tier-2 tag.",
        "Score 4 = dedicated outcome/output plus a matching IRRF Tier-2 linkage tag.",
      ].join("\n"),
      toolsUsed: [],
    };
  }
  return {
    text: "I can define IRRF, LNOB, GEWE, ROLSHR, or explain what a specific 0–4 score means — which one?",
    toolsUsed: [],
  };
}

/** The local NLP harness: parse the latest user turn (with conversational
 * context from earlier turns), resolve it to a grounded answer, and return
 * plain text plus which tools backed it. No network call, no LLM. */
export function answerLocally(messages: Msg[]): NlpAnswer {
  const userTurns = messages.filter((m) => m.role === "user").map((m) => m.content);
  const current = userTurns[userTurns.length - 1] ?? "";
  const priorUserTurns = userTurns.slice(0, -1);
  const context = deriveContext(priorUserTurns);

  if (!current.trim()) return clarifyUnknown();

  const countries = resolveCountries(current);
  const themeResult = resolveSingleTheme(current);
  const theme = themeResult && !themeResult.ambiguous ? themeResult.theme : null;
  const themeAmbiguous = themeResult && themeResult.ambiguous ? themeResult.candidates : null;
  const scoreBand = resolveScoreBand(current);
  const limit = resolveLimit(current);

  const entities: ParsedEntities = { countries, theme, themeAmbiguous, scoreBand, limit };
  const { intent } = classifyIntent(current, entities);

  switch (intent) {
    case "greeting":
      return {
        text: "Hi! Ask me about a country, a theme, or a score — e.g. \"which countries score 4 on Justice\" or \"tell me about Mali\".",
        toolsUsed: [],
      };
    case "thanks":
      return { text: "You're welcome — ask away.", toolsUsed: [] };
    case "help":
      return { text: HELP_TEXT, toolsUsed: [] };
    case "define":
      return formatDefine(current);
    case "overview": {
      const { text } = formatOverview();
      return { text, toolsUsed: ["get_overview"] };
    }
    case "countryProfile": {
      const target = countries[0] ?? context.lastCountries[0];
      if (!target) return clarifyNoCountry();
      return formatCountryProfile(target);
    }
    case "compare": {
      let targets = countries;
      if (targets.length < 2 && context.lastCountries[0]) {
        targets = [...targets, context.lastCountries[0]].slice(0, 2);
      }
      if (targets.length < 2) {
        return {
          text: "Give me two countries to compare, e.g. \"compare Mali and Kenya\".",
          toolsUsed: [],
        };
      }
      return formatCompare(targets[0], targets[1]);
    }
    case "evidence": {
      const target = countries[0] ?? context.lastCountries[0];
      if (!target) return clarifyNoCountry();
      if (themeAmbiguous) return clarifyThemeAmbiguous(themeAmbiguous);
      const th = theme ?? context.lastTheme;
      return formatEvidence(target, th);
    }
    case "manualReview": {
      if (themeAmbiguous) return clarifyThemeAmbiguous(themeAmbiguous);
      const country = countries[0] ?? null;
      return formatManualReview(theme, country, limit);
    }
    case "themeQuery": {
      if (themeAmbiguous) return clarifyThemeAmbiguous(themeAmbiguous);
      const th = theme ?? context.lastTheme;
      if (!th && !scoreBand) return clarifyNoTheme();
      if (th && !scoreBand && !current.match(/\d|which|list|how many|top|first/i)) {
        // Bare theme mention, e.g. just "Justice" — give the summary, not a 135-row dump.
        return { text: formatThemeSummary(th), toolsUsed: ["get_overview"] };
      }
      return formatMatrixQuery(th, scoreBand, limit);
    }
    default:
      return clarifyUnknown();
  }
}
