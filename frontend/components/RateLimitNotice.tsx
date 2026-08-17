"use client";

import { Gauge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** StudioNet public RPC quotas (confirmed by GenLayer). */
export const STUDIONET_RATE_LIMIT =
  "StudioNet limits RPC to 30 requests/minute and 500/hour. Wait for the quota to reset before sending another transaction.";

export function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limited") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  );
}

/** Rewrite cryptic viem/RPC rate-limit errors into actionable copy. */
export function friendlyTxError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  if (isRateLimitError(raw)) {
    return `${STUDIONET_RATE_LIMIT} Do not spam Confirm — each attempt burns quota.`;
  }
  return raw;
}

export function RateLimitNotice() {
  return (
    <Alert className="border-amber/40 bg-amber/10 text-foreground">
      <Gauge className="h-4 w-4 text-amber" />
      <AlertTitle className="text-amber">StudioNet rate limit</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        Public RPC allows <strong className="text-foreground">30 requests/minute</strong> and{" "}
        <strong className="text-foreground">500/hour</strong>. Avoid rapid retries and repeated
        publishes while testing — wait about a minute after a rate-limit error before trying again.
      </AlertDescription>
    </Alert>
  );
}
