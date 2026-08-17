/**
 * Phone helpers for the country-code selector. Kept free of React so the
 * splitting logic can be tested on its own.
 */

/** Country dial codes, Brazil first — it is the primary market. */
export const DIAL_CODES = [
  { code: "55", label: "🇧🇷 +55" },
  { code: "1", label: "🇺🇸 +1" },
  { code: "351", label: "🇵🇹 +351" },
  { code: "34", label: "🇪🇸 +34" },
  { code: "54", label: "🇦🇷 +54" },
  { code: "56", label: "🇨🇱 +56" },
  { code: "57", label: "🇨🇴 +57" },
  { code: "52", label: "🇲🇽 +52" },
  { code: "58", label: "🇻🇪 +58" },
  { code: "595", label: "🇵🇾 +595" },
  { code: "598", label: "🇺🇾 +598" },
  { code: "44", label: "🇬🇧 +44" },
  { code: "49", label: "🇩🇪 +49" },
  { code: "33", label: "🇫🇷 +33" },
  { code: "39", label: "🇮🇹 +39" },
] as const;

export const DEFAULT_DIAL = "55";

/** Split "+5511900000000" into its dial code and the national number. */
export function splitPhone(value?: string | null): { dial: string; number: string } {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return { dial: DEFAULT_DIAL, number: "" };

  // Longest match wins, so "+1" never shadows "+55" (or "+35" vs "+351").
  const match = DIAL_CODES.map((c) => c.code as string)
    .sort((a, b) => b.length - a.length)
    .find((code) => digits.startsWith(code));

  return match
    ? { dial: match, number: digits.slice(match.length) }
    : { dial: DEFAULT_DIAL, number: digits };
}

/** Recombine into the E.164 string the API stores. Empty number → empty value. */
export function joinPhone(dial: string, number: string): string {
  const digits = number.replace(/\D/g, "");
  return digits ? `+${dial}${digits}` : "";
}
