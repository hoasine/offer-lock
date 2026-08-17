import { describe, expect, it } from "vitest";
import { formatCountdown, formatGen, parseGenToWei, shortAddr } from "@/lib/utils/format";

describe("format helpers", () => {
  it("shortens addresses", () => {
    expect(shortAddr("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });

  it("formats GEN amounts from bigint and string", () => {
    expect(formatGen(50_000_000_000_000_000n)).toBe("0.05");
    expect(formatGen("1000000000000000000")).toBe("1");
    expect(formatGen(10_000_000_000_000_000n)).toBe("0.01");
  });

  it("parses GEN to wei and rejects invalid precision", () => {
    expect(parseGenToWei("0.01")).toBe(10_000_000_000_000_000n);
    expect(parseGenToWei("0.05")).toBe(50_000_000_000_000_000n);
    expect(() => parseGenToWei("0.0000000000000000001")).toThrow(/18 decimal/);
    expect(() => parseGenToWei("0")).toThrow(/greater than 0/);
  });

  it("formats countdown", () => {
    const now = 1_700_000_000_000;
    expect(formatCountdown(1_700_000_000 + 90, now)).toBe("1m 30s");
    expect(formatCountdown(1_700_000_000, now)).toBe("Ready now");
  });
});
