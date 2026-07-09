import { getData } from "../data";
import { THEME_ALIASES } from "./lexicon";
import { normalize, tokenize, similarity } from "./text";

/** Strip the " CPD 2024-2027" / " MCP ..." / " RPD ..." / trailing year-range suffix. */
function bareCountryName(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^(.*?)\s+(?:CPD|MCP|RPD)\b/i);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  s = s.replace(/\s*-?\s*\d{4}\s*-\s*\d{4}\s*$/, "").trim();
  return s.replace(/\s+/g, " ").trim();
}

/** A handful of common-usage aliases that don't literally appear in the CPD name field. */
const COUNTRY_ALIASES: Record<string, string> = {
  drc: "COD",
  "dr congo": "COD",
  "congo kinshasa": "COD",
  "congo brazzaville": "COG",
  "republic of congo": "COG",
  vietnam: "VNM",
  laos: "LAO",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "north macedonia": "MKD",
  macedonia: "MKD",
  moldova: "MDA",
  car: "CAF",
  "central african republic": "CAF",
  palestine: "PAL",
  palestinian: "PAL",
  swaziland: "SWZ",
  burma: "MMR",
  "cape verde": "CPV",
};

interface CountryEntry {
  code: string;
  fullName: string;
  bareName: string;
  normBareName: string;
}

let countryIndex: CountryEntry[] | null = null;
function getCountryIndex(): CountryEntry[] {
  if (countryIndex) return countryIndex;
  const data = getData();
  countryIndex = data.inventory.map((i) => {
    const fullName = i.name ?? i.code;
    const bareName = bareCountryName(fullName);
    return { code: i.code, fullName, bareName, normBareName: normalize(bareName) };
  });
  return countryIndex;
}

export interface CountryMatch {
  code: string;
  name: string;
  score: number;
}

/** Short display name for a country code (strips the " CPD 2024-2027" suffix). */
export function bareNameForCode(code: string): string {
  const hit = getCountryIndex().find((c) => c.code === code);
  return hit ? hit.bareName : code;
}

/**
 * Resolve country mentions in free text. Tries, in order: ISO3 code token,
 * known alias, exact bare-name substring, then fuzzy token similarity for
 * typo tolerance. Returns matches sorted best-first; caller decides how many
 * to accept (exact / unambiguous vs. "did you mean").
 */
export function resolveCountries(text: string): CountryMatch[] {
  const idx = getCountryIndex();
  const norm = normalize(text);
  const tokens = tokenize(text);
  const found = new Map<string, number>();

  // 1. ISO3 code as a standalone token (case-insensitive, exact).
  for (const tok of tokens) {
    if (tok.length === 3) {
      const hit = idx.find((c) => c.code.toLowerCase() === tok);
      if (hit) found.set(hit.code, Math.max(found.get(hit.code) ?? 0, 1));
    }
  }

  // 2. Known alias phrases.
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (norm.includes(alias)) {
      found.set(code, Math.max(found.get(code) ?? 0, 0.97));
    }
  }

  // 3. Exact bare-name substring match (handles multi-word names).
  for (const c of idx) {
    if (c.normBareName.length >= 3 && norm.includes(c.normBareName)) {
      found.set(c.code, Math.max(found.get(c.code) ?? 0, 0.95));
    }
  }

  // 4. Fuzzy single-token match for typos, only if nothing exact found yet.
  if (found.size === 0) {
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      for (const c of idx) {
        const nameTokens = c.normBareName.split(" ");
        for (const nt of nameTokens) {
          if (nt.length < 4) continue;
          const sim = similarity(tok, nt);
          if (sim >= 0.8) {
            found.set(c.code, Math.max(found.get(c.code) ?? 0, sim * 0.9));
          }
        }
      }
    }
  }

  return idx
    .filter((c) => found.has(c.code))
    .map((c) => ({ code: c.code, name: c.bareName, score: found.get(c.code)! }))
    .sort((a, b) => b.score - a.score);
}

export interface ThemeMatch {
  theme: string;
  matchedPhrase: string;
  score: number;
}

/** Distinct, meaningful (length >= 4) tokens across a theme's alias phrases. */
const THEME_TOKENS: Record<string, string[]> = Object.fromEntries(
  Object.entries(THEME_ALIASES).map(([theme, aliases]) => [
    theme,
    Array.from(
      new Set(
        aliases.flatMap((a) => normalize(a).split(" ")).filter((t) => t.length >= 4)
      )
    ),
  ])
);

/**
 * Resolve theme mentions. Scores by matched-alias length so more specific
 * phrases ("gender justice") win over a shorter alias that's also a substring
 * of a different theme's name ("justice"). Falls back to fuzzy token
 * similarity (typo tolerance) only when no exact alias substring matched.
 */
export function resolveThemes(text: string): ThemeMatch[] {
  const norm = normalize(text);
  const hits: ThemeMatch[] = [];
  for (const [theme, aliases] of Object.entries(THEME_ALIASES)) {
    let best: { phrase: string; len: number } | null = null;
    for (const alias of aliases) {
      if (norm.includes(normalize(alias))) {
        if (!best || alias.length > best.len) best = { phrase: alias, len: alias.length };
      }
    }
    if (best) hits.push({ theme, matchedPhrase: best.phrase, score: best.len });
  }
  if (hits.length > 0) return hits.sort((a, b) => b.score - a.score);

  // No exact alias matched anywhere — try fuzzy token matching for typos.
  const queryTokens = tokenize(text).filter((t) => t.length >= 4);
  const fuzzy: ThemeMatch[] = [];
  for (const [theme, themeTokens] of Object.entries(THEME_TOKENS)) {
    let best: { token: string; sim: number } | null = null;
    for (const qt of queryTokens) {
      for (const tt of themeTokens) {
        const sim = similarity(qt, tt);
        if (sim >= 0.78 && (!best || sim > best.sim)) best = { token: tt, sim };
      }
    }
    if (best) fuzzy.push({ theme, matchedPhrase: best.token, score: best.sim * 20 });
  }
  return fuzzy.sort((a, b) => b.score - a.score);
}

/** Pick a single unambiguous theme from resolveThemes, or null if none/ambiguous. */
export function resolveSingleTheme(
  text: string
): { theme: string; ambiguous: false } | { candidates: string[]; ambiguous: true } | null {
  const hits = resolveThemes(text);
  if (hits.length === 0) return null;
  const top = hits[0].score;
  const tied = hits.filter((h) => h.score === top);
  if (tied.length === 1) return { theme: tied[0].theme, ambiguous: false };
  return { candidates: tied.map((h) => h.theme), ambiguous: true };
}

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

const WORD_NUM: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4 };

function parseNum(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s in WORD_NUM ? WORD_NUM[s] : null;
}

/** Resolve a 0-4 score band from qualitative or numeric phrasing. */
export function resolveScoreBand(text: string): ScoreBand | null {
  const n = normalize(text);
  const NUM = "(\\d|zero|one|two|three|four)";

  let m = n.match(new RegExp(`exactly ${NUM}|only ${NUM}`));
  if (m) {
    const v = parseNum(m[1] ?? m[2]);
    if (v !== null) return { min: v, max: v, label: `exactly ${v}` };
  }

  m = n.match(new RegExp(`at least ${NUM}|${NUM} or more|minimum(?: of)? ${NUM}`));
  if (m) {
    const v = parseNum(m[1] ?? m[2] ?? m[3]);
    if (v !== null) return { min: v, max: 4, label: `>= ${v}` };
  }

  m = n.match(new RegExp(`more than ${NUM}`));
  if (m) {
    const v = parseNum(m[1]);
    if (v !== null && v < 4) return { min: v + 1, max: 4, label: `> ${v}` };
  }

  m = n.match(new RegExp(`at most ${NUM}|${NUM} or less|maximum(?: of)? ${NUM}`));
  if (m) {
    const v = parseNum(m[1] ?? m[2] ?? m[3]);
    if (v !== null) return { min: 0, max: v, label: `<= ${v}` };
  }

  m = n.match(new RegExp(`less than ${NUM}`));
  if (m) {
    const v = parseNum(m[1]);
    if (v !== null && v > 0) return { min: 0, max: v - 1, label: `< ${v}` };
  }

  if (/\b(highest|top scoring|top-scoring|best|fully linked|irrf[- ]?tagged|\btagged\b)\b/.test(n)) {
    return { min: 4, max: 4, label: "= 4 (dedicated + IRRF-tagged)" };
  }
  if (/\b(untagged|not tagged|dedicated but|gap)\b/.test(n)) {
    return { min: 3, max: 3, label: "= 3 (dedicated, untagged)" };
  }
  if (/\b(cross[- ]cutting|general mention|weak mention)\b/.test(n)) {
    return { min: 2, max: 2, label: "= 2 (cross-cutting mention)" };
  }
  if (/\b(no mention|not mentioned|zero mentions?|absent|missing entirely)\b/.test(n)) {
    return { min: 0, max: 0, label: "= 0 (no mention)" };
  }
  if (/\b(any mention|mentioned at all|at all)\b/.test(n)) {
    return { min: 1, max: 4, label: ">= 1 (any mention)" };
  }

  m = n.match(new RegExp(`\\bscore(?:s|d)?\\s*(?:of|is|=|:)?\\s*${NUM}\\b`));
  if (m) {
    const v = parseNum(m[1]);
    if (v !== null) return { min: v, max: v, label: `= ${v}` };
  }

  return null;
}

/** "top 5", "first 10", "5 examples" -> a result-count limit. */
export function resolveLimit(text: string): number | null {
  const n = normalize(text);
  let m = n.match(/\b(?:top|first|show me)\s+(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  m = n.match(/\b(\d+)\s+(?:examples?|results?|countries|of them)\b/);
  if (m) return parseInt(m[1], 10);
  return null;
}
