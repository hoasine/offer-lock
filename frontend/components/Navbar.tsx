"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountPanel } from "./AccountPanel";
import { Logo, LogoMark } from "./Logo";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const threshold = 80;
      setIsScrolled(scrollY > 20);
      setScrollProgress(Math.min(Math.max((scrollY - 10) / threshold, 0), 1));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const paddingTop = Math.round(scrollProgress * 16);
  const headerHeight = 64 - Math.round(scrollProgress * 8);
  const borderRadius =
    typeof window !== "undefined" && window.innerWidth >= 768
      ? Math.round(scrollProgress * 9999)
      : 0;

  return (
    <header
      className="fixed top-0 right-0 left-0 z-50 transition-all duration-500 ease-out"
      style={{ paddingTop: `${paddingTop}px` }}
    >
      <div
        className="transition-all duration-500 ease-out"
        style={{
          width: "100%",
          maxWidth: isScrolled ? "80rem" : "100%",
          margin: "0 auto",
          borderRadius: `${borderRadius}px`,
        }}
      >
        <div
          className="border backdrop-blur-xl transition-all duration-500 ease-out md:rounded-none"
          style={{
            borderColor: `oklch(0.3 0.02 0 / ${0.4 + scrollProgress * 0.4})`,
            background: `linear-gradient(135deg, oklch(0.18 0.01 0 / ${0.1 + scrollProgress * 0.3}) 0%, oklch(0.15 0.01 0 / ${0.05 + scrollProgress * 0.25}) 50%, oklch(0.16 0.01 0 / ${0.08 + scrollProgress * 0.27}) 100%)`,
            borderRadius: `${borderRadius}px`,
            borderWidth: "1px",
            borderLeftWidth: isScrolled ? "1px" : "0px",
            borderRightWidth: isScrolled ? "1px" : "0px",
            borderTopWidth: isScrolled ? "1px" : "0px",
            boxShadow: isScrolled
              ? "0 32px 64px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 oklch(0.3 0.02 0 / 0.3)"
              : "none",
            backdropFilter: "blur(16px) saturate(180%)",
            WebkitBackdropFilter: "blur(16px) saturate(180%)",
          }}
        >
          <div
            className="mx-auto px-6 transition-all duration-500"
            style={{ maxWidth: isScrolled ? "80rem" : "112rem" }}
          >
            <div
              className="flex items-center justify-between transition-all duration-500"
              style={{ height: `${headerHeight}px` }}
            >
              <Link href="/" className="flex items-center gap-3" aria-label="OfferLock home">
                <LogoMark size="md" className="flex md:hidden" />
                <Logo size="md" className="hidden md:flex" />
                <span className="ml-2 text-lg font-bold md:text-xl">OfferLock</span>
              </Link>
              <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
                Pin the offer. Stake GEN. Claim bait-and-switch.
              </div>
              <AccountPanel />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
