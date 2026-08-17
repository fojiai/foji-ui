import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Badges are state, so they follow the heat rule: tinted, bordered chips rather
   than saturated fills. A wall of solid colour reads as decoration and stops
   telling the owner where to look. `live` and `attention` are the only variants
   allowed to burn hot. */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.7rem] font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-border/70 bg-muted text-muted-foreground",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive-ink",
        outline: "border-border text-foreground",
        /* Running right now — the forge is lit. */
        live: "border-forge/30 bg-forge/12 text-forge-ink",
        /* Waiting on a human. The hottest thing on the screen. */
        attention: "border-spark/45 bg-spark/18 text-spark-ink",
        /* Cooled metal — done, resolved, healthy. */
        success: "border-quench/30 bg-quench/12 text-quench-ink",
        /* Cold iron — off, idle, nothing wrong. */
        idle: "border-border bg-muted/60 text-muted-foreground",
        warning: "border-spark/45 bg-spark/18 text-spark-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
