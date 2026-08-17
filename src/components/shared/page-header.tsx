import { cn } from "@/lib/utils";

/**
 * Every page used to open with a bare `text-3xl font-bold` — the same weight,
 * the same size, no sense of where you are. This gives each screen a stamped
 * display title with a mono eyebrow above it, so the page announces itself the
 * way a label stamped into a tool does.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="type-label mb-2 flex items-center gap-2 text-muted-foreground">
            <span className="h-px w-5 bg-primary" />
            {eyebrow}
          </p>
        )}
        <h1 className="type-display text-[1.9rem] sm:text-[2.15rem]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
