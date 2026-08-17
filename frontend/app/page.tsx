"use client";

import { Suspense } from "react";
import { Lock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { OfferApp } from "@/components/offer/OfferApp";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow px-4 pt-24 pb-16 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-12 animate-fade-in text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Lock className="h-3.5 w-3.5" />
              Project · GenLayer Studionet
            </div>
            <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl lg:text-6xl">
              Offer<span className="text-gradient">Lock</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Pin the offer. Stake GEN. Claim bait-and-switch against the version you accepted.
            </p>
          </header>
          <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
            <OfferApp />
          </Suspense>
        </div>
      </main>
      <footer className="space-y-4 border-t border-white/5 px-4 py-8">
        <p className="text-center text-xs text-muted-foreground">
          OfferLock · Powered by GenLayer · Employment fairness prototype — not legal advice
        </p>
      </footer>
    </div>
  );
}
