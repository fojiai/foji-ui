import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  const sections = [
    "dataCollected", "legalBasis", "dataUse", "dataSharing",
    "dataRetention", "yourRights", "cookies", "internationalTransfers",
    "children", "changes", "contact",
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("lastUpdated")}</p>
      </div>

      <p className="text-muted-foreground">{t("intro")}</p>

      {sections.map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-lg">{t(`${key}.title`)}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-line text-muted-foreground">{t(`${key}.content`)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
