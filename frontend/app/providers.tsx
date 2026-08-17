"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000,
            refetchOnWindowFocus: false,
            retry: 1,
            throwOnError: false,
          },
        },
      })
  );

  // genlayer-js logs failed RPC polls with console.error, which Next.js turns into
  // the red "1 Issue" overlay even when the on-chain tx already succeeded.
  useEffect(() => {
    const original = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const text = args.map((a) => String(a)).join(" ");
      if (text.includes("Error fetching") && text.includes("from GenLayer RPC")) {
        console.warn(...args);
        return;
      }
      original(...args);
    };
    return () => {
      console.error = original;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>{children}</WalletProvider>
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        offset={80}
        gap={12}
        toastOptions={{
          classNames: {
            toast: "ga-toast",
            closeButton: "ga-toast-close",
          },
          style: {
            background: "oklch(0.18 0.03 220)",
            border: "1px solid oklch(0.3 0.04 210)",
            color: "oklch(0.96 0.01 200)",
            boxShadow: "0 8px 32px oklch(0.08 0.02 220 / 0.85)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
