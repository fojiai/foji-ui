"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AnvilMark } from "@/components/shared/marks";
import { cn } from "@/lib/utils";

type Tone = "invite" | "warn" | "stop";

const TONE_RING: Record<Tone, string> = {
  invite: "text-muted-foreground/45",
  warn: "text-spark-ink/60",
  stop: "text-destructive/55",
};

const TONE_BORDER: Record<Tone, string> = {
  invite: "border-border",
  warn: "border-spark/35",
  stop: "border-destructive/35",
};

/* Tone needs to survive at a glance without a full-card wash. A solid rule
   along the top edge does it in one structural stroke: an invitation gets
   nothing, something needing action gets spark, something blocking gets
   destructive. Reads instantly, costs no attention when absent. */
const TONE_RULE: Record<Tone, string | null> = {
  invite: null,
  warn: "bg-spark",
  stop: "bg-destructive",
};

/* The tinted radial wash that used to sit behind these is gone. Between the
   hatching, the wash, the tinted mark and the tinted border, one empty state
   was running four decorative devices at once — and the wash was the one doing
   the least work while costing the most attention. Tone now rides on the mark
   and the border alone. */

/**
 * Empty states are left-aligned and asymmetric on purpose. The centered
 * round-icon-over-centered-text layout is the default look of every generated
 * dashboard, and it reads as an apology. This one puts the brand's own object
 * on a hatched patch of bench — the shape of what will be here — and reads in
 * the same left-to-right rhythm as the rest of the page.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  tone = "invite",
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "plate relative overflow-hidden rounded-xl border bg-card",
        TONE_BORDER[tone],
        className
      )}
    >
      {TONE_RULE[tone] && (
        <div
          className={cn("absolute inset-x-0 top-0 h-[3px]", TONE_RULE[tone])}
          aria-hidden="true"
        />
      )}

      {/* Bench hatching, fading out toward the copy so it never fights the text. */}
      <div
        className="hatch pointer-events-none absolute inset-y-0 right-0 w-2/5 opacity-50"
        style={{ maskImage: "linear-gradient(to left, black, transparent)", WebkitMaskImage: "linear-gradient(to left, black, transparent)" }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-start sm:gap-9 sm:p-10">
        <div className={cn("shrink-0", TONE_RING[tone])}>
          <AnvilMark className="h-16 w-16" lit={tone === "invite"} />
        </div>

        <div className="min-w-0">
          {eyebrow && <p className="type-label text-muted-foreground">{eyebrow}</p>}
          <h2 className="type-display mt-2 text-xl">{title}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          {(action || secondaryAction) && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {action}
              {secondaryAction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoCompanyState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <EmptyState
      eyebrow={t("emptyStates.eyebrowStart")}
      title={t("emptyStates.noCompanyTitle")}
      description={t("emptyStates.noCompanyDescription")}
      action={
        <Button asChild>
          <Link href={`/${locale}/onboarding`}>{t("onboarding.createCompany")}</Link>
        </Button>
      }
    />
  );
}

export function NoPlanState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <EmptyState
      tone="warn"
      eyebrow={t("emptyStates.eyebrowBilling")}
      title={t("emptyStates.noPlanTitle")}
      description={t("emptyStates.noPlanDescription")}
      action={
        <Button asChild>
          <Link href={`/${locale}/billing`}>{t("emptyStates.subscribePlan")}</Link>
        </Button>
      }
    />
  );
}

export function TrialExpiredState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <EmptyState
      tone="stop"
      eyebrow={t("emptyStates.eyebrowBilling")}
      title={t("emptyStates.trialExpiredTitle")}
      description={t("emptyStates.trialExpiredDescription")}
      action={
        <Button asChild>
          <Link href={`/${locale}/billing`}>{t("emptyStates.subscribePlan")}</Link>
        </Button>
      }
    />
  );
}

/** Super admin has no company selected — a state, not a failure. */
export function NoCompanySelectedState() {
  const t = useTranslations();
  return (
    <EmptyState
      eyebrow={t("emptyStates.eyebrowAdmin")}
      title={t("superAdmin.noCompanySelectedTitle")}
      description={t("superAdmin.noCompanySelected")}
    />
  );
}
