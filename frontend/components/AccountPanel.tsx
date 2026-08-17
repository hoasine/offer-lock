"use client";

import { useState } from "react";
import { User, LogOut, AlertCircle, ExternalLink, Droplets } from "lucide-react";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { success, error, userRejected } from "@/lib/utils/toast";
import { AddressDisplay } from "./AddressDisplay";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { getContractAddress } from "@/lib/genlayer/client";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";

export function AccountPanel() {
  const {
    address,
    isConnected,
    isMetaMaskInstalled,
    isOnCorrectNetwork,
    isLoading,
    connectWallet,
    disconnectWallet,
    switchWalletAccount,
    switchToStudionet,
  } = useWallet();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const hasContract = Boolean(getContractAddress());

  const handleConnect = async () => {
    if (!isMetaMaskInstalled) return;
    try {
      setIsConnecting(true);
      setConnectionError("");
      await connectWallet();
      setIsModalOpen(false);
      success("Wallet connected");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setConnectionError(msg);
      if (!msg.includes("rejected")) {
        error("Connection failed", { description: msg });
      } else {
        userRejected("Connection cancelled");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isConnected) {
    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button variant="gradient" disabled={isLoading}>
            <User className="mr-2 h-4 w-4" />
            Connect wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="brand-card max-w-md border-2">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">
              Connect MetaMask
            </DialogTitle>
            <DialogDescription>
              Studionet · Chain ID 61999 · Token GEN
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {!isMetaMaskInstalled ? (
              <>
                <Alert className="border-peach/40 bg-peach/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>MetaMask not installed</AlertTitle>
                  <AlertDescription>
                    Install MetaMask to send transactions on GenLayer Studionet.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => window.open(METAMASK_INSTALL_URL, "_blank")}
                  variant="gradient"
                  className="h-12 w-full"
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Install MetaMask
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleConnect}
                  variant="gradient"
                  className="h-12 w-full"
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect MetaMask"}
                </Button>
                {connectionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  Studio will add GenLayer Studionet automatically. Get test GEN via the faucet
                  on studio.genlayer.com.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <div className="flex items-center gap-2">
        {!isOnCorrectNetwork && (
          <Button
            variant="outline"
            size="sm"
            className="border-peach/50 text-peach"
            onClick={() => switchToStudionet().catch((e) => error(String(e)))}
            aria-label="Switch wallet to GenLayer Studionet"
          >
            Switch network
          </Button>
        )}
        <div className="hidden items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-sm sm:flex">
          <div
            className={`h-2 w-2 rounded-full ${
              isOnCorrectNetwork ? "bg-[var(--mint)]" : "animate-pulse bg-[var(--peach)]"
            }`}
          />
          <AddressDisplay address={address} maxLength={10} />
          {hasContract && (
            <span className="text-[10px] font-semibold text-[oklch(0.5_0.12_168)]">IC ✓</span>
          )}
        </div>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <User className="h-4 w-4" />
            <span className="sr-only">Open wallet details</span>
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="brand-card max-w-md border-2">
        <DialogHeader>
          <DialogTitle className="font-display">Your wallet</DialogTitle>
          <DialogDescription>GenLayer Studionet</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="brand-card p-4">
            <p className="mb-1 text-xs text-muted-foreground">Address</p>
            <code className="break-all text-xs">{address}</code>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                isOnCorrectNetwork ? "bg-[var(--mint)]" : "bg-[var(--peach)]"
              }`}
            />
            {isOnCorrectNetwork ? "On GenLayer network" : "Wrong network — switch in MetaMask"}
          </div>
          <Alert className="border-sky/40 bg-sky/10">
            <Droplets className="h-4 w-4 text-[oklch(0.55_0.14_240)]" />
            <AlertDescription className="text-xs">
              Need GEN? Open{" "}
              <a
                href="https://studio.genlayer.com"
                className="font-medium text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Studio
              </a>{" "}
              → Faucet
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                setIsSwitching(true);
                await switchWalletAccount();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "";
                if (!msg.includes("rejected")) error(msg || "Switch failed");
              } finally {
                setIsSwitching(false);
              }
            }}
            disabled={isSwitching}
            aria-label="Switch connected wallet account"
          >
            Switch account
          </Button>
          <Button
            variant="outline"
            className="w-full text-destructive"
            onClick={() => {
              disconnectWallet();
              setIsModalOpen(false);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
