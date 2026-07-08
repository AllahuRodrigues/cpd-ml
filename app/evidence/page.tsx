import { getData } from "@/lib/data";
import EvidenceExplorer from "@/components/EvidenceExplorer";

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const data = getData();
  const initialCode = typeof sp.code === "string" ? sp.code : "";
  const initialTheme = typeof sp.theme === "string" ? sp.theme : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          The verbatim outcome/output statements behind each theme score, with the
          matched keyword strength and IRRF linkage tag(s). This is the closest
          thing to a &ldquo;section-level snippet&rdquo; available from the
          structured export — there are no page numbers here because no CPD PDF
          text was provided (see Overview), except where noted for Layer-3
          verified countries.
        </p>
      </div>
      <EvidenceExplorer
        details={data.evidenceDetail}
        inventory={data.inventory}
        themeNames={data.themeNames}
        initialCode={initialCode}
        initialTheme={initialTheme}
      />
    </div>
  );
}
