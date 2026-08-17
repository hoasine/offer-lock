"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { getContractAddress, getStudioUrl, ensureGenLayerNetwork } from "@/lib/genlayer/client";
import {
  OfferLockClient,
  type ClaimKind,
  type TransactionProgress,
} from "@/lib/contracts/OfferLock";

export type OfferFilter = "all" | "employer" | "intern" | "open";

export function useOfferLockClient() {
  const { address } = useWallet();
  const contract = getContractAddress();
  return useMemo(() => {
    if (!contract) return null;
    return new OfferLockClient(contract, address, getStudioUrl());
  }, [contract, address]);
}

export function useOffers(filter: OfferFilter = "all") {
  const client = useOfferLockClient();
  const { address } = useWallet();
  return useQuery({
    queryKey: ["offers", getContractAddress(), filter, address],
    queryFn: async () => {
      if (!client) return [];
      const list = await client.getAllOffers();
      const sorted = [...list].sort((a, b) => b.id - a.id);
      const me = address?.toLowerCase();
      if (filter === "employer") {
        if (!me) return [];
        return sorted.filter((o) => o.employer.toLowerCase() === me);
      }
      if (filter === "intern") {
        if (!me) return [];
        return sorted.filter((o) => o.intern.toLowerCase() === me);
      }
      if (filter === "open") {
        return sorted.filter((o) => o.has_open_claim || o.status === "OPEN" || o.status === "ACCEPTED");
      }
      return sorted;
    },
    enabled: !!client,
    refetchInterval: 60_000,
    retry: 0,
  });
}

export function useOfferAmendments(offerId: number, enabled = true) {
  const client = useOfferLockClient();
  return useQuery({
    queryKey: ["offer-amendments", getContractAddress(), offerId],
    queryFn: () => client!.getOfferAmendments(offerId),
    enabled: !!client && enabled && offerId >= 0,
    refetchInterval: 60_000,
    retry: 0,
  });
}

export function useOfferClaims(offerId: number, enabled = true) {
  const client = useOfferLockClient();
  return useQuery({
    queryKey: ["offer-claims", getContractAddress(), offerId],
    queryFn: () => client!.getOfferClaims(offerId),
    enabled: !!client && enabled && offerId >= 0,
    refetchInterval: 60_000,
    retry: 0,
  });
}

export function useProtocolConfig() {
  const client = useOfferLockClient();
  return useQuery({
    queryKey: ["offer-lock-config", getContractAddress()],
    queryFn: () => client!.getProtocolConfig(),
    enabled: !!client,
    staleTime: 60_000,
  });
}

export function useFairnessLedger() {
  const client = useOfferLockClient();
  return useQuery({
    queryKey: ["offer-lock-ledger", getContractAddress()],
    queryFn: () => client!.getFairnessLedger(),
    enabled: !!client,
    refetchInterval: 60_000,
    retry: 0,
  });
}

function useInvalidateOffers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["offer-amendments"] });
    queryClient.invalidateQueries({ queryKey: ["offer-claims"] });
    queryClient.invalidateQueries({ queryKey: ["offer-lock-ledger"] });
  };
}

export function useOfferWrites() {
  const client = useOfferLockClient();
  const invalidate = useInvalidateOffers();

  const wrap = <T extends unknown[]>(
    fn: (c: OfferLockClient, ...args: T) => Promise<unknown>
  ) =>
    useMutation({
      mutationFn: async (vars: T) => {
        if (!client) throw new Error("Contract not configured");
        await ensureGenLayerNetwork();
        return fn(client, ...vars);
      },
      onSuccess: invalidate,
    });

  return {
    publish: wrap(
      (
        c,
        intern: string,
        title: string,
        role: string,
        stipend: string,
        hours: string,
        location: string,
        startAt: number,
        duties: string,
        notes: string,
        offerUrl: string,
        hosts: string,
        bond: bigint,
        breachWindow: number,
        amendWindow: number,
        total: bigint,
        onProgress?: (p: TransactionProgress) => void
      ) =>
        c.publishOffer(
          intern,
          title,
          role,
          stipend,
          hours,
          location,
          startAt,
          duties,
          notes,
          offerUrl,
          hosts,
          bond,
          breachWindow,
          amendWindow,
          total,
          onProgress
        )
    ),
    accept: wrap((c, offerId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.acceptOffer(offerId, onProgress)
    ),
    leave: wrap((c, offerId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.leaveOffer(offerId, onProgress)
    ),
    amend: wrap(
      (
        c,
        offerId: number,
        role: string,
        stipend: string,
        hours: string,
        location: string,
        startAt: number,
        duties: string,
        notes: string,
        reason: string,
        collateral: bigint,
        onProgress?: (p: TransactionProgress) => void
      ) =>
        c.amendOffer(
          offerId,
          role,
          stipend,
          hours,
          location,
          startAt,
          duties,
          notes,
          reason,
          collateral,
          onProgress
        )
    ),
    file: wrap(
      (
        c,
        offerId: number,
        kind: ClaimKind,
        amendmentId: number,
        reason: string,
        notes: string,
        urls: string,
        stake: bigint,
        onProgress?: (p: TransactionProgress) => void
      ) => c.fileClaim(offerId, kind, amendmentId, reason, notes, urls, stake, onProgress)
    ),
    respond: wrap(
      (c, claimId: number, response: string, onProgress?: (p: TransactionProgress) => void) =>
        c.respondToClaim(claimId, response, onProgress)
    ),
    cancel: wrap((c, claimId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.cancelClaim(claimId, onProgress)
    ),
    judge: wrap((c, claimId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.judgeClaim(claimId, onProgress)
    ),
    appeal: wrap(
      (
        c,
        claimId: number,
        reason: string,
        stake: bigint,
        onProgress?: (p: TransactionProgress) => void
      ) => c.appealClaim(claimId, reason, stake, onProgress)
    ),
    judgeAppeal: wrap((c, claimId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.judgeAppeal(claimId, onProgress)
    ),
    settle: wrap((c, claimId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.settleClaim(claimId, onProgress)
    ),
    releaseBond: wrap((c, offerId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.releasePerformanceBond(offerId, onProgress)
    ),
    releaseAmend: wrap((c, amendmentId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.releaseAmendmentCollateral(amendmentId, onProgress)
    ),
    close: wrap((c, offerId: number, onProgress?: (p: TransactionProgress) => void) =>
      c.closeOffer(offerId, onProgress)
    ),
  };
}
