/**
 * Suggested colours for the customer's chat widget. These are the customer's
 * brand choices (data), not Foji theme colours — hence hex values here.
 */
export const WIDGET_COLOR_PRESETS = [
  { key: "red", hex: "#E5262B" },
  { key: "orange", hex: "#EA580C" },
  { key: "yellow", hex: "#CA8A04" },
  { key: "green", hex: "#16A34A" },
  { key: "teal", hex: "#0D9488" },
  { key: "blue", hex: "#2563EB" },
  { key: "purple", hex: "#7C3AED" },
  { key: "pink", hex: "#DB2777" },
  { key: "brown", hex: "#92400E" },
  { key: "graphite", hex: "#1F2937" },
] as const;

export const isHexColor = (v: string | undefined | null): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

function luminance(hex: string): number {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

/**
 * The text/icon colour the widget puts on this colour: white, unless dark
 * text reads better. Same rule as onPrimary() in foji-widget/public/widget.js.
 */
export function inkOn(hex: string): "#ffffff" | "#1f2937" {
  const l = luminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0656 ? "#ffffff" : "#1f2937";
}

/** Very light colours get a thin outline in the widget so they don't vanish on a white site. */
export const needsOutline = (hex: string) => luminance(hex) > 0.8;
