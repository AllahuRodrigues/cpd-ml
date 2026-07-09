# CPD × ROLSHR Theme Analysis

A Next.js dashboard over UNDP Country Programme Document (CPD) theme-coding: 135
country programmes scored 0–4 across 9 themes (Rule of Law, Security, Human
Rights, Justice, Peacebuilding, Conflict Prevention, Local Action, Gender Justice
/ GEWE, LNOB) and cross-referenced with IRRF Tier-2 indicator linkages.

## Tabs

- **Overview** — executive summary, scoring rubric, data provenance and limits.
- **CPD Inventory** — country, CPD period, status, missing-data flags, Layer-3 verification.
- **Theme Matrix** — the 0–4 country × theme heatmap; click a cell for evidence.
- **Evidence** — the verbatim outcome/output text behind every score.
- **IRRF Linkage Review** — per-theme tagging coverage across score buckets.
- **Manual Review List** — dedicated-but-untagged results (underreporting candidates).

All data comes from `data/cpd_analysis.json`, derived from the structured CPD
outcome/output export. No text is invented — every score traces to a verbatim
statement.

## Data Assistant (chat)

A floating chat assistant (bottom-right, on every page) answers questions about
the data — countries, themes, scores, IRRF gaps, comparisons, and follow-ups
("what about Kenya?"). Two interchangeable engines, picked automatically:

- **Local NLP (default, no API key)** — `lib/nlp/`. A self-contained
  parser/harness: tokenizes and normalizes the question, resolves country
  and theme entities (with typo-tolerant fuzzy matching and a small alias
  table — "DRC", "Vietnam", etc.), extracts a 0–4 score band from qualitative
  or numeric phrasing, classifies intent, carries country/theme context
  across turns, and answers by calling the same grounded lookup functions in
  `lib/chat.ts`. **No network call, no LLM, works fully offline.** This is
  what runs today, since no `ANTHROPIC_API_KEY` is configured.
- **Claude (optional enhancement)** — `app/api/chat/route.ts`, model
  `claude-opus-4-8`, tool-use loop over the same `lib/chat.ts` tools. Activates
  automatically the moment `ANTHROPIC_API_KEY` is set — no code change needed.

Either way, **accuracy is enforced by grounding**: every answer is produced by
looking up exact facts in `data/cpd_analysis.json` (`lib/chat.ts`), never by
invented text. `GET /api/chat` reports which engine is active
(`{"engine":"nlp"|"llm"}`) and the chat header shows it.

### Enable the Claude engine (optional)

```bash
cp .env.local.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Without a key, the local NLP engine answers instead — nothing is disabled, and
all dashboard tabs work regardless.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
```

## Accessibility

Skip-link to main content, labelled search/filter controls, `aria-current` nav
state, visible keyboard focus rings, and a keyboard-operable chat panel (Esc to
close, focus management, `role="log"` live region for streamed replies).
