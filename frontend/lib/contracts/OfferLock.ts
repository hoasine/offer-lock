import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export type OfferStatus =
  | "OPEN"
  | "ACCEPTED"
  | "AMENDED"
  | "CLAIMED"
  | "JUDGED"
  | "SETTLED"
  | "LEFT"
  | "CLOSED";
export type ClaimKind = "BREACH" | "AMEND";
export type ClaimStatus = "OPEN" | "JUDGED" | "SETTLED" | "CANCELLED";
export type Verdict = "UPHOLD" | "BREACH" | "INCONCLUSIVE" | "";

export type OfferView = {
  id: number;
  employer: string;
  intern: string;
  title: string;
  role: string;
  stipend: string;
  hours_per_week: string;
  location: string;
  start_at: number;
  duties: string;
  notes: string;
  offer_url: string;
  evidence_hosts: string;
  base_stake: number | string;
  performance_bond: number | string;
  created_at: number;
  accepted_at: number;
  accepted: boolean;
  intern_left: boolean;
  version: number;
  pin_version: number;
  pin_snapshot: string;
  amendment_count: number;
  claim_count: number;
  open_claim_id: number;
  has_open_claim: boolean;
  breach_window_seconds: number;
  amend_window_seconds: number;
  breach_deadline_at: number;
  performance_bond_released: boolean;
  status: OfferStatus;
  closed: boolean;
};

export type AmendmentView = {
  id: number;
  offer_id: number;
  employer: string;
  reason: string;
  kind: "MATERIAL" | "CLARIFICATION";
  old_snapshot: string;
  new_snapshot: string;
  stake: number | string;
  created_at: number;
  challenge_deadline: number;
  version: number;
  has_open_claim: boolean;
  claim_id: number;
  collateral_released: boolean;
  claimed_once: boolean;
};

export type ClaimView = {
  id: number;
  offer_id: number;
  kind: ClaimKind;
  amendment_id: number;
  version_id: number;
  intern: string;
  reason: string;
  evidence_notes: string;
  evidence_urls: string;
  employer_response: string;
  stake: number | string;
  item_stake: number | string;
  created_at: number;
  response_deadline_at: number;
  judge_deadline_at: number;
  judged_at: number;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  status: ClaimStatus;
  paid_out: boolean;
  responded_at: number;
  judged_without_employer_response: boolean;
  appeal_deadline_at: number;
  appealed: boolean;
  appeal_stake: number | string;
  appellant: string;
  appeal_reason: string;
  appeal_verdict: Verdict;
  appeal_confidence: number;
  appeal_reasoning: string;
};

export type FairnessLedger = {
  uphold: number;
  breach: number;
  inconclusive: number;
  cancelled: number;
  judged: number;
  judged_without_employer_response: number;
};

export type ProtocolConfig = {
  minimum_stake: number | string;
  min_window: number | string;
  max_window: number | string;
  default_breach_window: number | string;
  default_amend_window: number | string;
  employer_response_window: number | string;
  judge_grace_window: number | string;
  appeal_window: number | string;
};

export type TransactionProgress = {
  hash?: string;
  stage: "preparing" | "submitted" | "finalizing" | "finalized";
};

export type WriteResult = {
  hash: string;
  receipt: unknown;
};

const AI_TX_WAIT = {
  retries: 45,
  interval: 2500,
  status: TransactionStatus.FINALIZED,
};
const FAST_TX_WAIT = {
  retries: 18,
  interval: 2000,
  status: TransactionStatus.ACCEPTED,
};

function isRpcNoiseError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? "").toLowerCase();
  return (
    msg.includes("gen_call") ||
    msg.includes("rate limit") ||
    msg.includes("rate limited") ||
    msg.includes("too many requests") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch") ||
    msg.includes("network")
  );
}

function withMutedGenLayerConsole<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof console === "undefined" || typeof console.error !== "function") {
    return fn();
  }
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (text.includes("Error fetching") && text.includes("from GenLayer RPC")) {
      return;
    }
    original(...args);
  };
  return fn().finally(() => {
    console.error = original;
  });
}

function normalizeReadValue(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of value.entries()) {
      obj[String(key)] = normalizeReadValue(entry);
    }
    return obj;
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeReadValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeReadValue(entry)])
    );
  }
  return value;
}

function normalizeReadResult<T>(raw: unknown): T {
  return normalizeReadValue(raw) as T;
}

export class OfferLockClient {
  private contractAddress: `0x${string}`;
  private readClient: ReturnType<typeof createClient>;
  private account?: `0x${string}`;
  private endpoint?: string;

  constructor(contractAddress: string, account?: string | null, endpoint?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.account = account ? (account as `0x${string}`) : undefined;
    this.endpoint = endpoint;
    const config: Record<string, unknown> = { chain: studionet };
    if (endpoint) config.endpoint = endpoint;
    this.readClient = createClient(config as Parameters<typeof createClient>[0]);
  }

  private async assertContractDeployed() {
    const endpoint = this.endpoint || "https://studio.genlayer.com/api";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "gen_getContractSchema",
          params: [this.contractAddress],
        }),
      });
      const data = (await res.json()) as {
        result?: { methods?: Record<string, unknown> };
        error?: { message?: string };
      };
      if (data.error || !data.result?.methods) {
        throw new Error(
          `No OfferLock contract at ${this.contractAddress} on Studionet. Deploy contracts/offer_lock.py in GenLayer Studio, then set NEXT_PUBLIC_CONTRACT_ADDRESS.`
        );
      }
      if (!("publish_offer" in data.result.methods)) {
        throw new Error(
          `Contract at ${this.contractAddress} is missing publish_offer. Confirm you deployed OfferLock.`
        );
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.startsWith("No OfferLock") || err.message.startsWith("Contract at"))
      ) {
        throw err;
      }
    }
  }

  private async getWriteClient() {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("A browser wallet is required to send transactions.");
    }
    const { ensureGenLayerNetwork, getAccounts, requestAccounts } = await import(
      "@/lib/genlayer/client"
    );
    await ensureGenLayerNetwork();
    await this.assertContractDeployed();
    let accounts = await getAccounts();
    if (accounts.length === 0) {
      accounts = await requestAccounts();
    }
    const account = (accounts[0] || this.account) as `0x${string}` | undefined;
    if (!account) {
      throw new Error("Connect your wallet to continue");
    }
    this.account = account;
    return createClient({
      chain: studionet,
      endpoint: this.endpoint,
      account,
      provider: window.ethereum as NonNullable<
        Parameters<typeof createClient>[0]
      >["provider"],
    });
  }

  private async studioRpc<T>(method: string, params: unknown[]): Promise<T> {
    const endpoint = this.endpoint || "https://studio.genlayer.com/api";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
    const data = (await res.json()) as { result?: T; error?: { message?: string } };
    if (data.error) {
      throw new Error(data.error.message || "Studio RPC error");
    }
    return data.result as T;
  }

  private statusReached(current: string, target: TransactionStatus | undefined): boolean {
    const cur = current.toUpperCase();
    const want = String(target ?? TransactionStatus.ACCEPTED).toUpperCase();
    if (cur.includes("CANCEL") || cur.includes("TIMEOUT")) return false;
    if (want.includes("FINAL")) {
      return cur === "FINALIZED" || cur === "ACCEPTED";
    }
    return cur === "ACCEPTED" || cur === "FINALIZED" || cur === "ACTIVATED";
  }

  private async waitForWrite(
    _client: ReturnType<typeof createClient>,
    hash: Awaited<ReturnType<ReturnType<typeof createClient>["writeContract"]>>,
    options: {
      retries: number;
      interval: number;
      status?: TransactionStatus;
    } = AI_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    const txHash = String(hash);
    onProgress?.({ hash: txHash, stage: "finalizing" });
    let lastStatus = "";
    const retries = Math.max(1, options.retries);
    for (let i = 0; i < retries; i++) {
      try {
        lastStatus = String(
          await this.studioRpc<string>("gen_getTransactionStatus", [txHash])
        ).toUpperCase();
        if (lastStatus.includes("CANCEL") || lastStatus.includes("TIMEOUT")) {
          throw new Error(`Transaction ${lastStatus.toLowerCase().replace(/_/g, " ")}.`);
        }
        if (this.statusReached(lastStatus, options.status)) {
          onProgress?.({ hash: txHash, stage: "finalized" });
          return { hash: txHash, receipt: { statusName: lastStatus } } satisfies WriteResult;
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Transaction ")) {
          throw err;
        }
        if (i >= 2 && isRpcNoiseError(err)) {
          onProgress?.({ hash: txHash, stage: "finalized" });
          return {
            hash: txHash,
            receipt: { statusName: lastStatus || "SUBMITTED", soft: true },
          } satisfies WriteResult;
        }
      }
      await new Promise((r) => setTimeout(r, options.interval));
    }
    onProgress?.({ hash: txHash, stage: "finalized" });
    return {
      hash: txHash,
      receipt: { statusName: lastStatus || "SUBMITTED", soft: true },
    } satisfies WriteResult;
  }

  private async write(
    functionName: string,
    args: Array<string | number>,
    value: bigint,
    wait = FAST_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    onProgress?.({ stage: "preparing" });
    const client = await this.getWriteClient();
    const hash = await withMutedGenLayerConsole(() =>
      client.writeContract({
        address: this.contractAddress,
        functionName,
        args,
        value,
      })
    );
    onProgress?.({ hash: String(hash), stage: "submitted" });
    return this.waitForWrite(client, hash, wait, onProgress);
  }

  async getAllOffers(): Promise<OfferView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_all_offers",
      args: [],
    });
    const list = normalizeReadResult<OfferView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getOfferAmendments(offerId: number): Promise<AmendmentView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_offer_amendments",
      args: [offerId],
    });
    const list = normalizeReadResult<AmendmentView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getOfferClaims(offerId: number): Promise<ClaimView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_offer_claims",
      args: [offerId],
    });
    const list = normalizeReadResult<ClaimView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getProtocolConfig(): Promise<ProtocolConfig> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_protocol_config",
      args: [],
    });
    return normalizeReadResult<ProtocolConfig>(raw);
  }

  async getFairnessLedger(): Promise<FairnessLedger> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_fairness_ledger",
      args: [],
    });
    return normalizeReadResult<FairnessLedger>(raw);
  }

  publishOffer(
    intern: string,
    title: string,
    role: string,
    stipend: string,
    hoursPerWeek: string,
    location: string,
    startAt: number,
    duties: string,
    notes: string,
    offerUrl: string,
    evidenceHosts: string,
    performanceBondWei: bigint,
    breachWindowSeconds: number,
    amendWindowSeconds: number,
    totalValueWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "publish_offer",
      [
        intern,
        title,
        role,
        stipend,
        hoursPerWeek,
        location,
        startAt,
        duties,
        notes,
        offerUrl,
        evidenceHosts,
        performanceBondWei.toString(),
        breachWindowSeconds,
        amendWindowSeconds,
      ],
      totalValueWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  acceptOffer(offerId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("accept_offer", [offerId], 0n, FAST_TX_WAIT, onProgress);
  }

  leaveOffer(offerId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("leave_offer", [offerId], 0n, FAST_TX_WAIT, onProgress);
  }

  amendOffer(
    offerId: number,
    role: string,
    stipend: string,
    hoursPerWeek: string,
    location: string,
    startAt: number,
    duties: string,
    notes: string,
    reason: string,
    collateralWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "amend_offer",
      [offerId, role, stipend, hoursPerWeek, location, startAt, duties, notes, reason],
      collateralWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  fileClaim(
    offerId: number,
    kind: ClaimKind,
    amendmentId: number,
    reason: string,
    evidenceNotes: string,
    evidenceUrls: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "file_claim",
      [offerId, kind, amendmentId, reason, evidenceNotes, evidenceUrls],
      stakeWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  respondToClaim(
    claimId: number,
    response: string,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("respond_to_claim", [claimId, response], 0n, FAST_TX_WAIT, onProgress);
  }

  cancelClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("cancel_claim", [claimId], 0n, FAST_TX_WAIT, onProgress);
  }

  judgeClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("judge_claim", [claimId], 0n, AI_TX_WAIT, onProgress);
  }

  appealClaim(
    claimId: number,
    reason: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("appeal_claim", [claimId, reason], stakeWei, FAST_TX_WAIT, onProgress);
  }

  judgeAppeal(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("judge_appeal", [claimId], 0n, AI_TX_WAIT, onProgress);
  }

  settleClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("settle_claim", [claimId], 0n, FAST_TX_WAIT, onProgress);
  }

  releasePerformanceBond(offerId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("release_performance_bond", [offerId], 0n, FAST_TX_WAIT, onProgress);
  }

  releaseAmendmentCollateral(
    amendmentId: number,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "release_amendment_collateral",
      [amendmentId],
      0n,
      FAST_TX_WAIT,
      onProgress
    );
  }

  closeOffer(offerId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("close_offer", [offerId], 0n, FAST_TX_WAIT, onProgress);
  }
}
