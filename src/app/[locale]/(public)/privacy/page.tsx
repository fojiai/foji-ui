import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  const sections = [
    "dataCollected", "legalBasis", "dataUse", "dataSharing",
    "dataRetention", "yourRights", "cookies", "internationalTransfers",
    "children", "changes", "contact",
  ] as const;

  return (
    /* A document, not a dashboard screen: constrained measure, generous
       leading, no cards. 34rem lands around 68 characters at this size. */
    <article className="mx-auto max-w-[34rem] pb-16">
      <header>
        <h1 className="type-display text-[1.9rem] sm:text-[2.15rem]">{t("title")}</h1>
        <p className="type-readout mt-2 text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </header>

      <p className="mt-6 leading-[1.75] text-muted-foreground">{t("intro")}</p>

      {sections.map((key) => (
        <section key={key} className="mt-10 first:mt-8">
          <h2 className="type-display text-lg">{t(`${key}.title`)}</h2>
          <p className="mt-3 whitespace-pre-line leading-[1.75] text-muted-foreground">
            {t(`${key}.content`)}
          </p>
        </section>
      ))}
    </article>
  );
}
