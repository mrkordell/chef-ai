import { test, expect, describe } from "bun:test";
import { cn, formatCookTime, formatDate } from "./utils.ts";

// ── cn (class name merging) ─────────────────────────────────────────

describe("cn", () => {
  test("merges simple class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  test("handles conditional classes via clsx syntax", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
    expect(cn("base", true && "active")).toBe("base active");
  });

  test("resolves tailwind conflicts (last wins)", () => {
    // tailwind-merge should keep only the last conflicting utility
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  test("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  test("handles empty string inputs", () => {
    expect(cn("", "px-2", "")).toBe("px-2");
  });

  test("handles array inputs", () => {
    expect(cn(["px-2", "py-1"])).toBe("px-2 py-1");
  });

  test("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});

// ── formatCookTime ──────────────────────────────────────────────────

describe("formatCookTime", () => {
  test("formats minutes under 60 as 'N min'", () => {
    expect(formatCookTime(15)).toBe("15 min");
    expect(formatCookTime(1)).toBe("1 min");
    expect(formatCookTime(59)).toBe("59 min");
  });

  test("formats exact hours without remaining minutes", () => {
    expect(formatCookTime(60)).toBe("1h");
    expect(formatCookTime(120)).toBe("2h");
  });

  test("formats hours and remaining minutes", () => {
    expect(formatCookTime(90)).toBe("1h 30m");
    expect(formatCookTime(75)).toBe("1h 15m");
    expect(formatCookTime(150)).toBe("2h 30m");
  });

  test("handles zero minutes", () => {
    expect(formatCookTime(0)).toBe("0 min");
  });
});

// ── formatDate ──────────────────────────────────────────────────────

describe("formatDate", () => {
  // The function uses elapsed-millisecond math (not calendar days), so
  // "yesterday" means 24-47 hours ago, "today" means < 24 hours ago, etc.

  test("returns 'Yesterday' for a timestamp ~30 hours ago", () => {
    const thirtyHoursAgo = Date.now() - 30 * 60 * 60 * 1000;
    expect(formatDate(thirtyHoursAgo)).toBe("Yesterday");
  });

  test("returns a weekday name for dates 2-6 days ago", () => {
    // 3 full days ago (72 hours)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const result = formatDate(threeDaysAgo);

    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    expect(weekdays).toContain(result);
  });

  test("returns a formatted date for timestamps older than a week", () => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const result = formatDate(twoWeeksAgo);

    // Should contain a month abbreviation and day number
    expect(result).toMatch(/\w{3}\s+\d{1,2}/);
  });

  test("includes year for dates from a different year", () => {
    // Use Jan 15 of last year to be safely in a different year
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    lastYear.setMonth(0, 15);
    lastYear.setHours(12, 0, 0, 0);
    const result = formatDate(lastYear.getTime());

    expect(result).toContain(String(lastYear.getFullYear()));
  });

  test("returns a time string for today's timestamps", () => {
    // A timestamp from 1 minute ago should show a time
    const oneMinuteAgo = Date.now() - 60_000;
    const result = formatDate(oneMinuteAgo);

    // Should contain a colon (time format like "3:45 PM" or "15:45")
    expect(result).toContain(":");
  });

  test("does not include year for dates in the current year", () => {
    // 10 days ago — same year, should not include the year number
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const result = formatDate(tenDaysAgo);
    const currentYear = String(new Date().getFullYear());

    expect(result).not.toContain(currentYear);
  });
});
