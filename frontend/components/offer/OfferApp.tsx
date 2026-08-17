"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContractSetupBanner } from "@/components/ContractSetupBanner";
import { RateLimitNotice } from "@/components/RateLimitNotice";
import { FairnessLedger } from "@/components/offer/FairnessLedger";
import { HowItWorks } from "@/components/offer/HowItWorks";
import { OfferCard } from "@/components/offer/OfferCard";
import { PublishOfferForm } from "@/components/offer/PublishOfferForm";
import { useOffers, type OfferFilter } from "@/lib/hooks/useOfferLock";
import { getContractAddress } from "@/lib/genlayer/client";

const FILTERS: { id: OfferFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "employer", label: "My offers" },
  { id: "intern", label: "Named intern" },
  { id: "open", label: "Open" },
];

export function OfferApp() {
  const [filter, setFilter] = useState<OfferFilter>("all");
  const { data: offers = [], isLoading, error } = useOffers(filter);
  const configured = Boolean(getContractAddress());

  return (
    <div className="space-y-8">
      <ContractSetupBanner />
      <HowItWorks />
      {configured && <FairnessLedger />}
      {configured && <RateLimitNotice />}
      {configured && <PublishOfferForm />}
      {configured && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={filter === item.id ? "gradient" : "outline"}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Loading offers…</p>}
          {error && (
            <p className="text-sm text-destructive">
              Could not read offers. Check the contract address and StudioNet quota.
            </p>
          )}
          <div className="grid gap-4">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
