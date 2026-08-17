type Jsonish = Record<string, unknown>;

function asRecord(value: unknown): Jsonish | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Jsonish)
    : null;
}

export function isTechnicalNoise(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "idle" ||
    lower.includes("userwarning") ||
    lower.includes("pickling storage") ||
    lower.includes("/py/libs/genlayer") ||
    lower.includes("warnings.warn") ||
    lower.includes("nondet mode") ||
    lower.includes("storage.py:") ||
    lower.startsWith("traceback (most recent call last)")
  );
}

export function isPendingResultName(resultName: unknown): boolean {
  const name = String(resultName ?? "").toUpperCase();
  return name === "IDLE" || name === "" || name === "NOT_VOTED";
}

export function isSuccessResultName(resultName: unknown): boolean {
  const name = String(resultName ?? "").toUpperCase();
  return name === "AGREE" || name === "MAJORITY_AGREE";
}

function isSuccessExecutionResult(result: unknown): boolean {
  if (typeof result === "string") {
    return result.trim().startsWith("pledge_");
  }
  const obj = asRecord(result);
  if (!obj) return false;
  const status = String(obj.status ?? "").toLowerCase();
  if (status === "return" || status === "success") return true;
  const payload = obj.payload;
  return typeof payload === "string" && payload.startsWith("pledge_");
}

function leaderReceipts(tx: Jsonish): Jsonish[] {
  const consensus = asRecord(tx.consensus_data) ?? asRecord(tx.consensusData);
  if (!consensus) return [];
  const leader = consensus.leader_receipt ?? consensus.leaderReceipt;
  if (Array.isArray(leader)) return leader.map((r) => asRecord(r)).filter(Boolean) as Jsonish[];
  const single = asRecord(leader);
  return single ? [single] : [];
}

function extractFromResultValue(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) {
    return parseUserErrorString(result);
  }

  const obj = asRecord(result);
  if (!obj) return null;

  // GenVM decoded result: { status: "rollback", payload: "user-facing message" }
  const status = String(obj.status ?? "").toLowerCase();
  const payload = obj.payload;
  if (
    typeof payload === "string" &&
    payload.trim() &&
    (status === "rollback" || status === "contract_error" || status === "error")
  ) {
    return payload.trim();
  }

  if (obj.type === "UserError" && typeof obj.message === "string") {
    return obj.message.trim();
  }

  if (typeof obj.message === "string") {
    const message = obj.message.trim();
    if (message && !isTechnicalNoise(message)) return message;
  }

  return null;
}

function parseUserErrorString(text: string): string | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const fromObj = extractFromResultValue(parsed);
    if (fromObj) return fromObj;
  } catch {
    // plain text
  }
  if (trimmed.length > 10 && !trimmed.startsWith("{")) return trimmed;
  return null;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out));
    return out;
  }
  const obj = asRecord(value);
  if (obj) {
    for (const v of Object.values(obj)) {
      collectStrings(v, out);
    }
  }
  return out;
}

function bestUserFacingMessage(candidates: string[]): string | null {
  const scored = candidates
    .map((raw) => {
      const parsed = extractFromResultValue(raw) ?? parseUserErrorString(raw) ?? raw.trim();
      return parsed;
    })
    .filter((text) => text.length > 10 && !isTechnicalNoise(text))
    .map((text) => {
      let score = Math.min(text.length, 300);
      const lower = text.toLowerCase();
      if (lower.includes("category mismatch")) score += 80;
      if (lower.includes("not a fundraising") || lower.includes("not a public")) score += 70;
      if (lower.includes("campaign") || lower.includes("fundraiser")) score += 40;
      if (lower.includes("reject")) score += 30;
      return { text, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text ?? null;
}

/** Pull human-readable error from a GenLayer transaction receipt. */
export function extractTxErrorMessage(tx: unknown): string | null {
  const root = asRecord(tx);
  if (!root) return null;

  const candidates: string[] = [];

  for (const receipt of leaderReceipts(root)) {
    if (isSuccessExecutionResult(receipt.result)) continue;

    const fromResult = extractFromResultValue(receipt.result);
    if (fromResult && !isTechnicalNoise(fromResult)) return fromResult;

    if (typeof receipt.error === "string") candidates.push(receipt.error);

    const genvm = asRecord(receipt.genvm_result) ?? asRecord(receipt.genvmResult);
    if (genvm) {
      if (typeof genvm.error === "string") candidates.push(genvm.error);
      if (typeof genvm.stdout === "string") candidates.push(genvm.stdout);
      // stderr last — often contains Python warnings, not the business error
      if (typeof genvm.stderr === "string") candidates.push(genvm.stderr);
      collectStrings(genvm, candidates);
    }

    collectStrings(receipt.eq_outputs, candidates);
  }

  const best = bestUserFacingMessage(candidates);
  if (best) return best;

  const statusName = String(root.statusName ?? "").toUpperCase();
  if (statusName.includes("CANCEL")) {
    return "Transaction was canceled on GenLayer.";
  }
  if (statusName.includes("TIMEOUT")) {
    return "Transaction timed out waiting for validators.";
  }

  return null;
}

export function isFailureResultName(resultName: unknown): boolean {
  const name = String(resultName ?? "").toUpperCase();
  return (
    name.includes("DISAGREE") ||
    name.includes("FAIL") ||
    name.includes("VIOLATION") ||
    name === "TIMEOUT"
  );
}
