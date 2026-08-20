"use client";

export function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Publish + pin later",
      body: "Employer names an intern, locks role / pay / hours / location / duties, and splits GEN into a close-only base stake plus a performance bond.",
    },
    {
      n: "2",
      title: "Intern accept",
      body: "Clock starts only after accept. That version is pinned. Later amends cannot overwrite the accepted snapshot.",
    },
    {
      n: "3",
      title: "Material amend vs clarify",
      body: "Changing locked fields opens a claim window and needs its own collateral. Notes-only changes do not.",
    },
    {
      n: "4",
      title: "Claim with public URLs",
      body: "One open claim. Evidence hosts are allowlisted. The contract fetches pages. Employer gets 3 days to reply. The caller pays the AI tx — no checker reward.",
    },
    {
      n: "5",
      title: "Item-scoped payout",
      body: "UPHOLD / BREACH / INCONCLUSIVE with on-chain confidence. Fetch fail is inconclusive. Leave does not skip windows. Disputed pots stay locked until payout. Base stake never pays a claim.",
    },
  ];

  return (
    <section className="brand-card p-6">
      <h2 className="mb-4 font-display text-xl font-semibold">How OfferLock works</h2>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <li key={step.n} className="soft-tile p-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-accent">STEP {step.n}</p>
            <p className="mb-1 font-medium">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
