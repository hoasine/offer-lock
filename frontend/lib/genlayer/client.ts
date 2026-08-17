"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, custom, type WalletClient } from "viem";

// GenLayer Network Configuration (from environment variables with fallbacks)
export const GENLAYER_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || "61999",
  10
);
// MetaMask expects lowercase 0x-hex chainId (EIP-155 / EIP-3085).
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16)}`;

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Studionet",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    decimals: 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api",
  ],
  blockExplorerUrls: ["https://studio.genlayer.com"],
};

function isMissingChainError(error: unknown): boolean {
  const err = error as {
    code?: number | string;
    message?: string;
    data?: { originalError?: { code?: number }; code?: number };
  };
  const code = typeof err?.code === "string" ? parseInt(err.code, 10) : err?.code;
  const nested =
    err?.data?.originalError?.code ?? err?.data?.code;
  const msg = String(err?.message || error || "").toLowerCase();
  // 4902 = unrecognized chain; MetaMask / other wallets often wrap it.
  return (
    code === 4902 ||
    nested === 4902 ||
    code === -32603 ||
    msg.includes("unrecognized chain") ||
    msg.includes("try adding the chain") ||
    msg.includes("wallet_addethereumchain")
  );
}

// Ethereum provider type from window
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function providerErrorCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

function providerErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}

function asAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Get the GenLayer RPC URL from environment variables
 */
export function getStudioUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api"
  );
}

/**
 * Get the contract address from environment variables
 */
export function getContractAddress(): string {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();
  if (!address) {
    return "";
  }
  return address;
}

/** GenLayer contract address: 0x + 40 hex chars */
export function isValidContractAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.ethereum?.isMetaMask;
}

/**
 * Get the Ethereum provider (MetaMask)
 */
export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

/**
 * Request accounts from MetaMask
 * @returns Array of addresses
 */
export async function requestAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    const accounts = asAddressList(
      await provider.request({
        method: "eth_requestAccounts",
      })
    );
    return accounts;
  } catch (error: unknown) {
    if (providerErrorCode(error) === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw new Error(`Failed to connect to MetaMask: ${providerErrorMessage(error)}`);
  }
}

/**
 * Get current MetaMask accounts without requesting permission
 * @returns Array of addresses
 */
export async function getAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    return [];
  }

  try {
    return asAddressList(
      await provider.request({
        method: "eth_accounts",
      })
    );
  } catch (error) {
    console.error("Error getting accounts:", error);
    return [];
  }
}

/**
 * Get the current chain ID from MetaMask
 */
export async function getCurrentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    const chainId = await provider.request({
      method: "eth_chainId",
    });
    return typeof chainId === "string" ? chainId : null;
  } catch (error) {
    console.error("Error getting chain ID:", error);
    return null;
  }
}

/**
 * Add GenLayer network to MetaMask
 */
export async function addGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [GENLAYER_NETWORK],
    });
  } catch (error: unknown) {
    if (providerErrorCode(error) === 4001) {
      throw new Error("User rejected adding the network");
    }
    throw new Error(`Failed to add GenLayer network: ${providerErrorMessage(error)}`);
  }
}

/**
 * Switch to GenLayer network (add chain first if MetaMask does not know it yet).
 */
export async function switchToGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err?.code === 4001) {
      throw new Error("User rejected switching the network");
    }
    if (isMissingChainError(error)) {
      await addGenLayerNetwork();
      // After adding, switch explicitly (some MM versions stay on previous chain).
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
        });
      } catch (switchAgain: unknown) {
        const again = switchAgain as { code?: number; message?: string };
        if (again?.code === 4001) {
          throw new Error("User rejected switching the network");
        }
        // Add succeeded — user may still need one manual confirm; verify below.
      }
      if (!(await isOnGenLayerNetwork())) {
        throw new Error(
          "Studionet was added but MetaMask is not on chain 61999 yet. Open MetaMask and select GenLayer Studionet."
        );
      }
      return;
    }
    const message =
      error instanceof Error ? error.message : String((error as { message?: string })?.message || error);
    throw new Error(`Failed to switch network: ${message}`);
  }
}

/**
 * Check if we're on the GenLayer network
 */
export async function isOnGenLayerNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();

  if (!chainId) {
    return false;
  }

  // Convert both to decimal for comparison
  const currentChainIdDecimal = parseInt(chainId, 16);
  return currentChainIdDecimal === GENLAYER_CHAIN_ID;
}

/**
 * Switch to GenLayer Studionet if MetaMask is on another chain (e.g. Arc).
 * Call before any write transaction.
 */
export async function ensureGenLayerNetwork(): Promise<void> {
  if (!(await isOnGenLayerNetwork())) {
    await switchToGenLayerNetwork();
  }
}

/**
 * Connect to MetaMask and ensure we're on GenLayer network
 * @returns The connected address
 */
export async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  // Request accounts
  const accounts = await requestAccounts();

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found");
  }

  // Check and switch to GenLayer network
  const onCorrectNetwork = await isOnGenLayerNetwork();

  if (!onCorrectNetwork) {
    await switchToGenLayerNetwork();
  }

  return accounts[0];
}

/**
 * Request user to switch MetaMask account
 * Shows MetaMask account picker even if already connected
 * Uses wallet_requestPermissions to force account selection dialog
 * @returns The newly selected account address
 */
export async function switchAccount(): Promise<string> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask is not installed");
  }

  try {
    // Request permissions - this shows account picker
    await provider.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });

    // Get the newly selected account
    const accounts = asAddressList(
      await provider.request({
        method: "eth_accounts",
      })
    );

    if (!accounts || accounts.length === 0) {
      throw new Error("No account selected");
    }

    return accounts[0];
  } catch (error: unknown) {
    const code = providerErrorCode(error);
    if (code === 4001) {
      throw new Error("User rejected account switch");
    } else if (code === -32002) {
      throw new Error("Account switch request already pending");
    }
    throw new Error(`Failed to switch account: ${providerErrorMessage(error)}`);
  }
}

/**
 * Create a viem wallet client from MetaMask provider
 */
export function createMetaMaskWalletClient(): WalletClient | null {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    return createWalletClient({
      chain: studionet as unknown as Parameters<typeof createWalletClient>[0]["chain"],
      transport: custom(provider as Parameters<typeof custom>[0]),
    });
  } catch (error) {
    console.error("Error creating wallet client:", error);
    return null;
  }
}

/**
 * Create a GenLayer client with MetaMask account
 *
 * Note: The genlayer-js SDK doesn't directly support custom transports like viem.
 * When an address is provided, the SDK will use the window.ethereum provider
 * automatically for transaction signing via MetaMask.
 */
export function createGenLayerClient(address?: string) {
  const config: Parameters<typeof createClient>[0] = {
    chain: studionet,
  };

  if (address) {
    config.account = address as `0x${string}`;
  }

  try {
    return createClient(config);
  } catch (error) {
    console.error("Error creating GenLayer client:", error);
    // Return client without account on error
    return createClient({
      chain: studionet,
    });
  }
}

/**
 * Get a client instance with MetaMask account
 */
export async function getClient() {
  const accounts = await getAccounts();
  const address = accounts[0];
  return createGenLayerClient(address);
}
