const SCORE_STYLE: Record<number, { bg: string; ink: string }> = {
  0: { bg: "transparent", ink: "var(--ink-muted)" },
  2: { bg: "var(--score-2)", ink: "var(--score-2-ink)" },
  3: { bg: "var(--score-3)", ink: "var(--score-3-ink)" },
  4: { bg: "var(--score-4)", ink: "var(--score-4-ink)" },
};

export default function ScoreCell({ score }: { score: number }) {
  const s = SCORE_STYLE[score] ?? SCORE_STYLE[0];
  return (
    <div
      className="tnum flex h-8 w-8 items-center justify-center rounded text-xs font-semibold"
      style={{
        background: s.bg,
        color: s.ink,
        border: score === 0 ? "1px dashed var(--grid)" : "none",
      }}
      title={`Score ${score}`}
    >
      {score}
    </div>
  );
}
