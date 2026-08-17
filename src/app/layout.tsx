import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* Display — a signage grotesque from Omnibus-Type (Buenos Aires). Heavy weights
   read as struck into metal, which is the anvil half of the brand. */
/* Loaded as a variable font: `axes` requires it, and the wdth axis is the whole
   point — see `.type-display` in globals.css. */
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

/* Body — narrower than Inter so tables hold more columns, and crisp at 14px.
   latin-ext covers the pt-BR / es diacritics. */
const instrumentSans = Instrument_Sans({
  variable: "--font-sans-brand",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

/* Utility — metrics, timestamps and uppercase micro-labels. Numbers should read
   as instrument readings, not as prose. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Foji AI",
  description: "Forje sua inteligência",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon_foji.png",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF2D2D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      suppressHydrationWarning
      className={`${archivo.variable} ${instrumentSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
