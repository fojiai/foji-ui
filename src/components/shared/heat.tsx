import { cn } from "@/lib/utils";

export type HeatLevel = "live" | "attention" | "cool" | "idle";

const DOT: Record<HeatLevel, string> = {
  live: "bg-forge",
  attention: "bg-spark",
  cool: "bg-quench",
  idle: "bg-muted-foreground/40",
};

const HALO: Record<HeatLevel, string> = {
  live: "bg-forge/25",
  attention: "bg-spark/30",
  cool: "bg-quench/20",
  idle: "bg-transparent",
};

/**
 * The status primitive for the whole app: one dot whose colour *is* the state.
 *
 * `live` breathes, because a running agent is the one thing on the screen that
 * is actually doing something while you look at it. Everything else holds still
 * so that motion stays meaningful. Colour is never the only channel — every
 * call site pairs this with a text label.
 */
export function HeatDot({
  level,
  className,
}: {
  level: HeatLevel;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)} aria-hidden="true">
      {level !== "idle" && (
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            HALO[level],
            level === "live" && "heat-live"
          )}
          style={{ transform: "scale(2.1)" }}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT[level])} />
    </span>
  );
}

/**
 * Dot + label, for list rows and card headers where the status needs a name.
 */
export function HeatStatus({
  level,
  label,
  className,
}: {
  level: HeatLevel;
  label: string;
  className?: string;
}) {
  const tone: Record<HeatLevel, string> = {
    live: "text-forge-ink",
    attention: "text-spark-ink",
    cool: "text-quench-ink",
    idle: "text-muted-foreground",
  };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <HeatDot level={level} />
      <span className={cn("type-label", tone[level])}>{label}</span>
    </span>
  );
}
