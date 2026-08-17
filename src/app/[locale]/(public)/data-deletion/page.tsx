import { useTranslations } from "next-intl";

/**
 * Data deletion instructions.
 *
 * Meta requires a reachable URL describing how a person deletes their data
 * before an app passes review, and LGPD Art. 18 requires the same thing
 * independently. Public by design — a page behind a login does not satisfy
 * either.
 */
export default function DataDeletionPage() {
  const t = useTranslations("dataDeletion");

  const sections = ["selfService", "byRequest", "whatIsDeleted", "whatIsKept", "contact"] as const;

  return (
    /* Document layout, same as the other legal pages: constrained measure,
       generous leading, no cards. */
    <article className="mx-auto max-w-[34rem] pb-16">
      <header>
        <h1 className="type-display text-[1.9rem] sm:text-[2.15rem]">{t("title")}</h1>
        <p className="type-readout mt-2 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </header>

      <p className="mt-6 leading-[1.75] text-muted-foreground">{t("intro")}</p>

      {sections.map((key) => (
        <section key={key} className="mt-10">
          <h2 className="type-display text-lg">{t(`${key}.title`)}</h2>
          <p className="mt-3 whitespace-pre-line leading-[1.75] text-muted-foreground">
            {t(`${key}.content`)}
          </p>
        </section>
      ))}
    </article>
  );
}
