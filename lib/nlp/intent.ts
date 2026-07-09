import { INTENT_PHRASES } from "./lexicon";
import { countPhrases, normalize } from "./text";
import type { CountryMatch, ScoreBand } from "./entities";

export type Intent =
  | "greeting"
  | "thanks"
  | "help"
  | "overview"
  | "compare"
  | "evidence"
  | "manualReview"
  | "themeQuery"
  | "countryProfile"
  | "define"
  | "unknown";

export interface ParsedEntities {
  countries: CountryMatch[];
  theme: string | null;
  themeAmbiguous: string[] | null;
  scoreBand: ScoreBand | null;
  limit: number | null;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
}

function phraseScore(text: string, phrases: readonly string[]): number {
  // Weight by matched-phrase length so specific phrases beat generic ones.
  const n = normalize(text);
  let score = 0;
  for (const p of phrases) {
    if (n.includes(normalize(p))) score += p.length;
  }
  return score;
}

export function classifyIntent(text: string, entities: ParsedEntities): IntentResult {
  const scores: Record<Intent, number> = {
    greeting: phraseScore(text, INTENT_PHRASES.greeting),
    thanks: phraseScore(text, INTENT_PHRASES.thanks),
    help: phraseScore(text, INTENT_PHRASES.help),
    overview: phraseScore(text, INTENT_PHRASES.overview),
    compare: phraseScore(text, INTENT_PHRASES.compare),
    evidence: phraseScore(text, INTENT_PHRASES.evidence),
    manualReview: phraseScore(text, INTENT_PHRASES.manualReview),
    themeQuery: phraseScore(text, INTENT_PHRASES.themeQuery),
    countryProfile: phraseScore(text, INTENT_PHRASES.countryProfile),
    define: phraseScore(text, INTENT_PHRASES.define),
    unknown: 0,
  };

  // Entity-informed boosts.
  const nCountries = entities.countries.length;
  const hasTheme = !!entities.theme;
  const hasScore = !!entities.scoreBand;

  if (nCountries >= 2 && countPhrases(text, ["compare", "versus", " vs ", "vs.", "and"]) > 0) {
    scores.compare += 40;
  }
  if (nCountries === 1 && !hasScore && scores.evidence === 0 && scores.manualReview === 0) {
    // A bare or lightly-qualified country mention leans toward a profile lookup.
    scores.countryProfile += 15;
  }
  if (hasTheme && hasScore) {
    scores.themeQuery += 20;
  }
  if (scores.evidence > 0 && nCountries >= 1) {
    scores.evidence += 25;
  }
  if (scores.manualReview > 0) {
    scores.manualReview += 20;
  }
  if (scores.overview > 0 && nCountries === 0) {
    scores.overview += 10;
  }
  // A single word matching only a theme name, nothing else: treat as themeQuery
  // with no score band so the responder gives the theme's full linkage summary.
  if (hasTheme && !hasScore && nCountries === 0 && scores.evidence === 0) {
    scores.themeQuery += 5;
  }

  let best: Intent = "unknown";
  let bestScore = 0;
  for (const key of Object.keys(scores) as Intent[]) {
    if (scores[key] > bestScore) {
      best = key;
      bestScore = scores[key];
    }
  }

  if (bestScore === 0) {
    // No keyword signal at all — fall back on entity shape alone.
    if (nCountries >= 2) return { intent: "compare", confidence: 0.4 };
    if (nCountries === 1) return { intent: "countryProfile", confidence: 0.5 };
    if (hasTheme) return { intent: "themeQuery", confidence: 0.4 };
    return { intent: "unknown", confidence: 0 };
  }

  return { intent: best, confidence: Math.min(1, bestScore / 30) };
}
