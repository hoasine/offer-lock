"use client";

import { useFairnessLedger } from "@/lib/hooks/useOfferLock";

export function FairnessLedger() {
  const { data: ledger } = useFairnessLedger();
  const rows = [
    { label: "Uphold", value: ledger?.uphold ?? 0 },
    { label: "Breach", value: ledger?.breach ?? 0 },
    { label: "Inconclusive", value: ledger?.inconclusive ?? 0 },
    { label: "Cancelled", value: ledger?.cancelled ?? 0 },
    { label: "Judged with no employer reply", value: ledger?.judged_without_employer_response ?? 0 },
  ];

  return (
    <section className="brand-card p-6">
      <h2 className="mb-1 font-display text-xl font-semibold">Fairness ledger</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Public on-chain counts — not a dashboard we can edit after the fact.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="soft-tile p-3 text-center">
            <p className="font-display text-2xl font-semibold text-accent">{row.value}</p>
            <p className="text-xs text-muted-foreground">{row.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
