import { getData } from "@/lib/data";
import InventoryTable from "@/components/InventoryTable";

export default function InventoryPage() {
  const data = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CPD Inventory</h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-secondary)" }}>
          {data.inventory.length}{" "}
          country programmes from the structured CPD
          outcome/output export. &ldquo;Status&rdquo; compares the CPD end date in
          the data against today ({data.generatedAt}) — an expired end date often
          means the CPD was extended or is mid-renewal, not that UNDP has no
          active programme; verify with the country office. This dataset has one
          row per country (the current CPD as tagged for the SP 2026&ndash;2029
          exercise) — previous-cycle CPDs are not included, so a
          current-vs-previous comparison isn&rsquo;t possible from this data alone.
        </p>
      </div>
      <InventoryTable items={data.inventory} />
    </div>
  );
}
