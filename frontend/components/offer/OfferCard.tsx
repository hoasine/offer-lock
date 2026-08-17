"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import {
  useOfferAmendments,
  useOfferClaims,
  useOfferWrites,
} from "@/lib/hooks/useOfferLock";
import type { OfferView } from "@/lib/contracts/OfferLock";
import { formatCountdown, formatGen, parseGenToWei } from "@/lib/utils/format";
import { error, success } from "@/lib/utils/toast";
import { friendlyTxError } from "@/components/RateLimitNotice";

export function OfferCard({ offer }: { offer: OfferView }) {
  const { address } = useWallet();
  const me = address?.toLowerCase() ?? "";
  const isEmployer = me && offer.employer.toLowerCase() === me;
  const isIntern = me && offer.intern.toLowerCase() === me;
  const now = Math.floor(Date.now() / 1000);
  const writes = useOfferWrites();
  const aiBusy = busy || writes.judge.isPending || writes.judgeAppeal.isPending;
  const { data: amendments = [] } = useOfferAmendments(offer.id);
  const { data: claims = [] } = useOfferClaims(offer.id);
  const openClaim = claims.find((c) => c.status === "OPEN") ?? claims.find((c) => c.status === "JUDGED");
  const latestClaim = claims[claims.length - 1];

  const [hours, setHours] = useState(offer.hours_per_week);
  const [reason, setReason] = useState("");
  const [urls, setUrls] = useState("https://example.com/proof");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const canAccept = isIntern && !offer.accepted && !offer.closed;
  const canLeave = isIntern && offer.accepted && !offer.intern_left && !offer.has_open_claim && !offer.closed;
  const canAmend = isEmployer && offer.accepted && !offer.has_open_claim && !offer.closed && !offer.intern_left;
  const breachOpen =
    offer.accepted &&
    !offer.intern_left &&
    !offer.performance_bond_released &&
    now >= Math.max(offer.start_at, offer.accepted_at) &&
    now <= offer.breach_deadline_at;
  const canFileBreach = isIntern && breachOpen && !offer.has_open_claim && !offer.closed;
  const materialOpen = amendments.find(
    (a) =>
      a.kind === "MATERIAL" &&
      !a.collateral_released &&
      !a.claimed_once &&
      now <= a.challenge_deadline
  );
  const canFileAmend = isIntern && !!materialOpen && !offer.has_open_claim && !offer.closed;
  const canRespond =
    isEmployer &&
    latestClaim?.status === "OPEN" &&
    !latestClaim.responded_at &&
    now <= latestClaim.response_deadline_at;
  const canJudge =
    latestClaim?.status === "OPEN" &&
    (latestClaim.responded_at > 0 || now >= latestClaim.response_deadline_at);
  const canCancel = isIntern && latestClaim?.status === "OPEN";
  const canSettle =
    latestClaim?.status === "JUDGED" &&
    !latestClaim.appealed &&
    now >= latestClaim.appeal_deadline_at &&
    !latestClaim.paid_out;
  const canAppeal =
    latestClaim?.status === "JUDGED" &&
    !latestClaim.appealed &&
    now < latestClaim.appeal_deadline_at &&
    ((latestClaim.verdict === "BREACH" && isEmployer) ||
      (latestClaim.verdict === "UPHOLD" && isIntern) ||
      (latestClaim.verdict === "INCONCLUSIVE" && (isEmployer || isIntern)));
  const canJudgeAppeal = latestClaim?.status === "JUDGED" && latestClaim.appealed && !latestClaim.paid_out;
  const canReleaseBond =
    isEmployer &&
    !offer.performance_bond_released &&
    !offer.has_open_claim &&
    (offer.intern_left || now >= offer.breach_deadline_at);
  const canClose =
    isEmployer &&
    !offer.closed &&
    !offer.has_open_claim &&
    (offer.intern_left || now >= offer.breach_deadline_at) &&
    amendments.every(
      (a) => a.kind !== "MATERIAL" || a.collateral_released || offer.intern_left || now >= a.challenge_deadline
    );

  const itemStake = useMemo(() => {
    if (canFileAmend && materialOpen) return BigInt(String(materialOpen.stake));
    return BigInt(String(offer.performance_bond || "0"));
  }, [canFileAmend, materialOpen, offer.performance_bond]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      setBusy(true);
      await fn();
      success(label);
    } catch (err) {
      error(label + " failed", { description: friendlyTxError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="brand-card space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{offer.title}</h3>
          <p className="text-sm text-muted-foreground">
            {offer.role} · {offer.hours_per_week}h · {offer.location} · {offer.stipend}
          </p>
        </div>
        <Badge>{offer.status}</Badge>
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>
          Employer <AddressDisplay address={offer.employer} showCopy />
        </p>
        <p>
          Intern <AddressDisplay address={offer.intern} showCopy />
        </p>
        <p>Pinned v{offer.pin_version || "—"} / current v{offer.version}</p>
        <p>
          Base {formatGen(offer.base_stake)} GEN · Bond {formatGen(offer.performance_bond)} GEN
        </p>
        {offer.accepted && (
          <p className="md:col-span-2 text-muted-foreground">
            Breach window {formatCountdown(offer.breach_deadline_at)}
          </p>
        )}
      </div>
      {offer.pin_snapshot && (
        <pre className="max-h-32 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-muted-foreground">
          {offer.pin_snapshot}
        </pre>
      )}
      {latestClaim && (
        <div className="soft-tile space-y-1 p-3 text-sm">
          <p>
            Claim #{latestClaim.id} {latestClaim.kind} · {latestClaim.status}
            {latestClaim.verdict ? ` · first ${latestClaim.verdict}` : ""}
            {latestClaim.appeal_verdict ? ` · appeal ${latestClaim.appeal_verdict}` : ""}
          </p>
          {latestClaim.status === "OPEN" && !latestClaim.responded_at && (
            <p className="text-amber">
              Employer reply window {formatCountdown(latestClaim.response_deadline_at)}
            </p>
          )}
          {latestClaim.judged_without_employer_response && (
            <p className="text-amber">Judged without an employer reply</p>
          )}
          {latestClaim.reasoning && (
            <p className="text-muted-foreground">{latestClaim.reasoning}</p>
          )}
          {latestClaim.appeal_reasoning && (
            <p className="text-muted-foreground">Appeal: {latestClaim.appeal_reasoning}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <Button disabled={aiBusy} onClick={() => run("Accepted", () => writes.accept.mutateAsync([offer.id]))}>
            Accept and pin
          </Button>
        )}
        {canLeave && (
          <Button variant="outline" disabled={aiBusy} onClick={() => run("Left", () => writes.leave.mutateAsync([offer.id]))}>
            Leave
          </Button>
        )}
        {canCancel && openClaim && (
          <Button
            variant="outline"
            disabled={aiBusy}
            onClick={() => run("Cancelled", () => writes.cancel.mutateAsync([openClaim.id]))}
          >
            Cancel claim
          </Button>
        )}
        {canJudge && latestClaim && (
          <Button
            variant="gradient"
            disabled={aiBusy}
            onClick={() => run("Judged", () => writes.judge.mutateAsync([latestClaim.id]))}
          >
            {writes.judge.isPending ? "Judging…" : "Judge"}
          </Button>
        )}
        {canJudgeAppeal && latestClaim && (
          <Button
            disabled={aiBusy}
            onClick={() => run("Appeal judged", () => writes.judgeAppeal.mutateAsync([latestClaim.id]))}
          >
            {writes.judgeAppeal.isPending ? "Judging appeal…" : "Judge appeal"}
          </Button>
        )}
        {canSettle && latestClaim && (
          <Button
            disabled={aiBusy}
            onClick={() => run("Settled", () => writes.settle.mutateAsync([latestClaim.id]))}
          >
            Settle payout
          </Button>
        )}
        {canReleaseBond && (
          <Button
            variant="outline"
            disabled={aiBusy}
            onClick={() => run("Bond released", () => writes.releaseBond.mutateAsync([offer.id]))}
          >
            Release bond
          </Button>
        )}
        {canClose && (
          <Button
            variant="outline"
            disabled={aiBusy}
            onClick={() => run("Closed", () => writes.close.mutateAsync([offer.id]))}
          >
            Close offer
          </Button>
        )}
      </div>

      {canAmend && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Hours (material if changed)</Label>
            <Input value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            className="md:col-span-2"
            disabled={aiBusy}
            onClick={() =>
              run("Amended", () =>
                writes.amend.mutateAsync([
                  offer.id,
                  offer.role,
                  offer.stipend,
                  hours,
                  offer.location,
                  offer.start_at,
                  offer.duties,
                  offer.notes,
                  reason || "Schedule change",
                  hours === offer.hours_per_week ? 0n : BigInt(String(offer.performance_bond)),
                ])
              )
            }
          >
            Amend offer
          </Button>
        </div>
      )}

      {(canFileBreach || canFileAmend) && (
        <div className="grid gap-2">
          <Label>Evidence URLs (allowlisted hosts)</Label>
          <Input value={urls} onChange={(e) => setUrls(e.target.value)} />
          <Label>Claim reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          {canFileBreach && (
            <Button
              disabled={aiBusy}
              onClick={() =>
                run("Breach claim filed", () =>
                  writes.file.mutateAsync([
                    offer.id,
                    "BREACH",
                    0,
                    reason || "Work does not match the pinned offer.",
                    "See linked public evidence.",
                    urls,
                    itemStake,
                  ])
                )
              }
            >
              File BREACH ({formatGen(itemStake)} GEN)
            </Button>
          )}
          {canFileAmend && materialOpen && (
            <Button
              disabled={aiBusy}
              onClick={() =>
                run("Amend claim filed", () =>
                  writes.file.mutateAsync([
                    offer.id,
                    "AMEND",
                    materialOpen.id,
                    reason || "Material amendment after accept.",
                    "See linked public evidence.",
                    urls,
                    BigInt(String(materialOpen.stake)),
                  ])
                )
              }
            >
              Claim amendment #{materialOpen.id}
            </Button>
          )}
        </div>
      )}

      {canRespond && latestClaim && (
        <div className="grid gap-2">
          <Label>Employer response</Label>
          <Textarea value={response} onChange={(e) => setResponse(e.target.value)} />
          <Button
            disabled={aiBusy}
            onClick={() =>
              run("Response sent", () =>
                writes.respond.mutateAsync([latestClaim.id, response || "We kept the pinned terms."])
              )
            }
          >
            Respond
          </Button>
        </div>
      )}

      {canAppeal && latestClaim && (
        <Button
          variant="outline"
          disabled={aiBusy}
          onClick={() =>
            run("Appealed", () =>
              writes.appeal.mutateAsync([
                latestClaim.id,
                "Requesting a second review of the pinned terms.",
                BigInt(String(latestClaim.item_stake || offer.performance_bond)),
              ])
            )
          }
        >
          Appeal once
        </Button>
      )}
    </article>
  );
}
