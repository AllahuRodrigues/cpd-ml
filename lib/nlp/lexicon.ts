/**
 * Domain vocabulary for the local NLP harness: theme aliases, intent keyword
 * sets, and a small glossary. Kept separate from the parsing logic so the
 * vocabulary can be extended without touching the algorithms.
 */

export const THEME_ALIASES: Record<string, string[]> = {
  "Rule of Law": ["rule of law", "rol"],
  Security: ["security"],
  "Human Rights": ["human rights", "human right"],
  Justice: ["justice", "access to justice", "judicial"],
  Peacebuilding: ["peacebuilding", "peace building", "peace-building"],
  "Conflict Prevention": ["conflict prevention", "conflict"],
  "Local Action": ["local action", "local governance", "localization", "localisation"],
  "Gender Justice / GEWE": [
    "gender justice",
    "gewe",
    "gender equality and women's empowerment",
    "gender equality",
    "women's empowerment",
    "gender",
  ],
  LNOB: ["lnob", "leave no one behind", "no one behind"],
};

/** Intent keyword sets. Longer/more specific phrases should be listed first. */
export const INTENT_PHRASES = {
  greeting: ["hello", "hi there", "hey there", "good morning", "good afternoon", "hi", "hey"],
  thanks: ["thank you", "thanks", "cheers", "appreciate it"],
  help: ["what can you do", "help me", "how do i use", "what can i ask"],
  overview: [
    "how many countries",
    "how many cpds",
    "total countries",
    "give me an overview",
    "dataset overview",
    "scoring rubric",
    "what does the scoring mean",
    "what do the scores mean",
    "data limitations",
    "layer 3",
    "layer-3",
    "layer3",
    "overview",
    "summary",
    "statistics",
    "stats",
  ],
  compare: ["compare", " versus ", " vs ", "vs.", "difference between", "which is higher", "which scores higher"],
  evidence: [
    "why does",
    "why is",
    "why did",
    "what's the evidence",
    "what is the evidence",
    "show me the evidence",
    "the evidence for",
    "source text",
    "outcome text",
    "output text",
    "verbatim",
    "quote",
    "cite",
    "citation",
    "rationale",
    "justify",
    "justification",
  ],
  manualReview: [
    "underreport",
    "under-report",
    "under report",
    "untagged",
    "not tagged",
    "missing tag",
    "manual review",
    "follow up candidate",
    "follow-up candidate",
    "gap",
    "gaps",
    "dedicated but",
  ],
  themeQuery: [
    "which countries",
    "which country",
    "list countries",
    "list the countries",
    "countries that score",
    "countries with a score",
    "countries scoring",
    "how many countries score",
    "how many have",
    "top scoring",
    "highest scoring",
    "lowest scoring",
    "score 4 on",
    "score 3 on",
    "score of 4",
    "score of 3",
  ],
  countryProfile: [
    "tell me about",
    "profile of",
    "profile for",
    "status of",
    "cpd for",
    "information on",
    "details on",
    "what do we know about",
  ],
  define: [
    "what is irrf",
    "what does irrf mean",
    "what is lnob",
    "what does lnob mean",
    "what is gewe",
    "what does gewe mean",
    "what does score",
    "what does a score of",
    "define",
    "definition of",
  ],
} as const;

export type IntentName = keyof typeof INTENT_PHRASES | "countryScore" | "unknown";

export const GLOSSARY: Record<string, string> = {
  irrf:
    "IRRF = the UNDP Integrated Results and Resources Framework — the corporate framework of standardized global indicators UNDP reports results against. \"IRRF Tier-2\" codes are the specific output-level indicators. In this dataset, a country×theme result reaches score 4 only when its outcome/output text is ALSO tagged to a matching IRRF Tier-2 code — otherwise it tops out at score 3.",
  lnob:
    "LNOB = Leave No One Behind, a cross-cutting UNDP/UN principle (reaching the furthest behind first). It has no standalone IRRF Tier-2 output code in this dataset, so it can reach at most score 3 from tagging data alone.",
  gewe:
    "GEWE = Gender Equality and Women's Empowerment. Paired here with \"Gender Justice\" as one theme, also cross-cutting with no standalone IRRF Tier-2 code — max score 3 from tagging data alone.",
  rolshr:
    "ROLSHR is shorthand for the Rule of Law, Security and Human Rights theme cluster this dashboard was originally built around, later extended to all 9 themes you see in the Theme Matrix.",
};
