import { resolveCountries, resolveSingleTheme, type CountryMatch } from "./entities";

export interface ConversationContext {
  lastCountries: CountryMatch[];
  lastTheme: string | null;
}

/**
 * Replay the earlier user turns in a conversation to recover "what were we
 * just talking about" — so a follow-up like "what about Kenya?" or "why?"
 * can borrow the country/theme from a prior turn instead of forcing the user
 * to repeat themselves every message.
 */
export function deriveContext(priorUserTurns: string[]): ConversationContext {
  let lastCountries: CountryMatch[] = [];
  let lastTheme: string | null = null;
  for (const turn of priorUserTurns) {
    const countries = resolveCountries(turn);
    if (countries.length > 0) lastCountries = countries;
    const themeResult = resolveSingleTheme(turn);
    if (themeResult && !themeResult.ambiguous) lastTheme = themeResult.theme;
  }
  return { lastCountries, lastTheme };
}
