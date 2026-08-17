"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOfferWrites, useProtocolConfig } from "@/lib/hooks/useOfferLock";
import { parseGenToWei } from "@/lib/utils/format";
import { error, success } from "@/lib/utils/toast";
import { friendlyTxError } from "@/components/RateLimitNotice";
import { useWallet } from "@/lib/genlayer/WalletProvider";

export function PublishOfferForm() {
  const { address } = useWallet();
  const { data: config } = useProtocolConfig();
  const { publish } = useOfferWrites();
  const [intern, setIntern] = useState("");
  const [title, setTitle] = useState("Backend intern");
  const [role, setRole] = useState("Software intern");
  const [stipend, setStipend] = useState("0.05 GEN/week");
  const [hours, setHours] = useState("20");
  const [location, setLocation] = useState("Remote");
  const [duties, setDuties] = useState("Build the public API. No coffee runs.");
  const [notes, setNotes] = useState("");
  const [offerUrl, setOfferUrl] = useState("https://example.com/offer");
  const [hosts, setHosts] = useState("example.com,github.com");
  const [bond, setBond] = useState("0.05");
  const [base, setBase] = useState("0.05");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      error("Connect a wallet first");
      return;
    }
    try {
      setBusy(true);
      const bondWei = parseGenToWei(bond);
      const baseWei = parseGenToWei(base);
      await publish.mutateAsync([
        intern.trim(),
        title,
        role,
        stipend,
        hours,
        location,
        0,
        duties,
        notes,
        offerUrl,
        hosts,
        bondWei,
        0,
        0,
        bondWei + baseWei,
      ]);
      success("Offer published");
    } catch (err) {
      error("Publish failed", { description: friendlyTxError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="brand-card grid gap-4 p-6 md:grid-cols-2">
      <h2 className="font-display text-xl font-semibold md:col-span-2">Publish a locked offer</h2>
      <p className="text-sm text-muted-foreground md:col-span-2">
        Value sent = performance bond + base stake. Minimum stake is{" "}
        {config ? String(config.minimum_stake) : "0.01 GEN wei"}. Named intern must accept before
        the clock starts.
      </p>
      <div className="space-y-2">
        <Label htmlFor="intern">Intern address</Label>
        <Input id="intern" value={intern} onChange={(e) => setIntern(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stipend">Stipend (locked text)</Label>
        <Input id="stipend" value={stipend} onChange={(e) => setStipend(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hours">Hours / week</Label>
        <Input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="duties">Duties</Label>
        <Textarea id="duties" value={duties} onChange={(e) => setDuties(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (clarifications only)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="offerUrl">Public offer URL</Label>
        <Input id="offerUrl" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="hosts">Evidence hosts (allowlist)</Label>
        <Input id="hosts" value={hosts} onChange={(e) => setHosts(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bond">Performance bond (GEN)</Label>
        <Input id="bond" value={bond} onChange={(e) => setBond(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="base">Base stake (GEN)</Label>
        <Input id="base" value={base} onChange={(e) => setBase(e.target.value)} required />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" variant="gradient" disabled={busy || publish.isPending}>
          {busy ? "Publishing…" : "Publish offer"}
        </Button>
      </div>
    </form>
  );
}
