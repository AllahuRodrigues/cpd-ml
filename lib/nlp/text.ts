/**
 * Text utilities for the local NLP harness: normalization, tokenization, and
 * fuzzy string matching. No external dependencies — this has to run reliably
 * offline with no model and no network call.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0);
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "in", "on", "at", "to", "for", "with", "and", "or", "but", "so",
  "do", "does", "did", "has", "have", "had", "can", "could", "would",
  "should", "will", "shall", "may", "might", "must", "i", "me", "my",
  "you", "your", "it", "its", "this", "that", "these", "those", "as",
  "by", "from", "about", "into", "than", "then", "there", "here",
  "what", "which", "who", "whom", "how", "please", "just", "also",
]);

export function contentTokens(s: string): string[] {
  return tokenize(s).filter((t) => !STOPWORDS.has(t));
}

/** Iterative Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/** 0..1 similarity, 1 = identical. Distance-based, tolerant of short strings. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** True if `phrase` appears as a contiguous substring of normalized `text`. */
export function hasPhrase(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase));
}

/** Count how many of the given phrases appear in normalized `text`. */
export function countPhrases(text: string, phrases: readonly string[]): number {
  const n = normalize(text);
  let hits = 0;
  for (const p of phrases) if (n.includes(normalize(p))) hits++;
  return hits;
}

/** Extract the first integer found in text matching one of several regexes, else null. */
export function firstNumber(text: string): number | null {
  const m = text.match(/\b(\d+)\b/);
  return m ? parseInt(m[1], 10) : null;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  none: 0,
  no: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

/** Parse a spelled-out small number (zero..four) from a token, else null. */
export function numberWord(token: string): number | null {
  return token in NUMBER_WORDS ? NUMBER_WORDS[token] : null;
}
