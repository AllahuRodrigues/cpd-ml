import { getData } from "@/lib/data";
import ManualReviewTable from "@/components/ManualReviewTable";

export default function ReviewPage() {
  const data = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manual Review List</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          {data.manualReview.length}{" "}
          country&times;theme cases where the CPD has a
          dedicated outcome or output statement on the theme, but it is not tagged
          to a matching global IRRF Tier-2 indicator. These are the candidates for
          direct follow-up with country offices (per your supervisor&rsquo;s
          underreporting hypothesis) — not confirmed underreporting, since some of
          these may simply be tagged to a different (equally valid) IRRF code.
          Rows already deep-verified against source PDFs (see Layer-3 work) are
          flagged.
        </p>
      </div>
      <ManualReviewTable items={data.manualReview} themeNames={data.themeNames} />
    </div>
  );
}
