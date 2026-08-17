import { cn } from "@/lib/utils";

/**
 * The anvil, drawn rather than borrowed. Empty states used to be a lucide icon
 * inside a tinted circle — the house style of every generated dashboard. This
 * is the brand's own object: cold iron, with sparks only when something has
 * actually been struck.
 *
 * `lit` adds the sparks and warms the horn — use it where the empty state is an
 * invitation to make something, not a report that something is missing.
 */
export function AnvilMark({
  className,
  lit = true,
}: {
  className?: string;
  lit?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 52"
      fill="none"
      aria-hidden="true"
      className={cn("h-14 w-14", className)}
    >
      {/* Sparks — struck off the horn, rising and cooling as they go. Kept
          clear of the anvil so the silhouette stays clean. */}
      {lit && (
        <g>
          <path
            d="M12 10.2 L14 5 L15.4 9.6 L19.6 7.4 L16.4 11.6 L20.4 13.4 L15.6 13.2 Z"
            className="fill-spark"
          />
          <circle cx="24.2" cy="4.6" r="1.5" className="fill-forge" />
          <circle cx="6.8" cy="6.4" r="1.1" className="fill-ember" />
          <circle cx="28.6" cy="9.8" r="0.9" className="fill-spark/70" />
        </g>
      )}

      {/* Anvil: horn sweeping left, flat working face, waist, flared base. */}
      <path
        d="M2 27
           C 6 20.5, 13 18, 22 18
           L 57 18
           A 1.6 1.6 0 0 1 58.6 19.6
           L 58.6 25.4
           A 1.6 1.6 0 0 1 57 27
           L 39 27
           L 36.6 34.6
           L 45 38
           A 2 2 0 0 1 46.2 39.9
           L 46.2 44.4
           L 17.8 44.4
           L 17.8 39.9
           A 2 2 0 0 1 19 38
           L 27.4 34.6
           L 25 27
           L 8 27
           C 3.6 27, 2 27, 2 27
           Z"
        className="fill-current"
      />

      {/* The working face catches the light — the one edge that stays polished.
          A thin highlight, not a second object sitting on top of the anvil. */}
      <path
        d="M23 18 L57 18 A1.6 1.6 0 0 1 58.6 19.6 L58.6 20.1 L22.4 20.1 C22.6 19.3 22.8 18.6 23 18 Z"
        className={lit ? "fill-spark/70" : "fill-white/[0.07]"}
      />
    </svg>
  );
}

/**
 * A heat gauge: five bars that fill as the value climbs. Used on the dashboard
 * band where a bare number ("3 agents") says nothing about whether that is a
 * healthy state. Encodes magnitude in form as well as in digits.
 */
export function HeatGauge({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const filled = max > 0 ? Math.round((Math.min(value, max) / max) * 5) : 0;

  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-colors",
            i === 0 && "h-2",
            i === 1 && "h-2.5",
            i === 2 && "h-3",
            i === 3 && "h-3.5",
            i === 4 && "h-4",
            i < filled ? "bg-forge" : "bg-current opacity-25"
          )}
        />
      ))}
    </span>
  );
}
