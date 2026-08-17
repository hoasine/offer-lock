"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { shortAddr } from "@/lib/utils/format";
import { success, error } from "@/lib/utils/toast";

interface AddressDisplayProps {
  address: string | null;
  maxLength?: number;
  className?: string;
  showCopy?: boolean;
}

export function AddressDisplay({
  address,
  maxLength = 12,
  className = "",
  showCopy = false,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return <span className={className}>—</span>;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success("Address copied!");
    } catch {
      error("Failed to copy address");
    }
  };

  const chars = Math.max(4, Math.floor(maxLength / 2));
  const shortened = shortAddr(address, chars);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={address}>
      <span className="font-mono">{shortened}</span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="rounded p-0.5 opacity-60 transition-opacity hover:bg-secondary hover:opacity-100"
          aria-label="Copy address"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[oklch(0.55_0.13_168)]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </span>
  );
}
