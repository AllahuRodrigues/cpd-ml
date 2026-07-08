import { getData } from "@/lib/data";
import ThemeMatrix from "@/components/ThemeMatrix";

export default function MatrixPage() {
  const data = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Theme Coding Matrix</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          Each cell is the highest score found across that country&rsquo;s outcome and
          output statements for that theme (0/2/3/4 — see Overview for the rubric
          and its limits). Click any cell to see the exact outcome/output text
          behind the score.
        </p>
      </div>
      <ThemeMatrix rows={data.matrix} themeNames={data.themeNames} />
    </div>
  );
}
