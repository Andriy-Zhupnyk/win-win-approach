// Spec 0004 — missing-key check: `messages/uk.json` and `messages/en.json`
// must declare exactly the same set of (dotted) keys. This runs as part of
// `npm run test` (and therefore CI), so a translation added to only one
// locale file fails the build rather than relying on reviewer discipline
// (see CLAUDE.md section 5).
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n message keys", () => {
  it("messages/uk.json and messages/en.json declare the same set of keys", () => {
    const enKeys = new Set(flattenKeys(en));
    const ukKeys = new Set(flattenKeys(uk));

    const missingFromUk = [...enKeys].filter((key) => !ukKeys.has(key)).sort();
    const missingFromEn = [...ukKeys].filter((key) => !enKeys.has(key)).sort();

    expect(
      missingFromUk,
      `keys present in en.json but missing from uk.json: ${missingFromUk.join(", ")}`,
    ).toEqual([]);
    expect(
      missingFromEn,
      `keys present in uk.json but missing from en.json: ${missingFromEn.join(", ")}`,
    ).toEqual([]);
  });
});
