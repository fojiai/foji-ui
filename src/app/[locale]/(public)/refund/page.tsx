import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function RefundPage() {
  const t = useTranslations("refund");

  const sections = [
    "policy", "regretPeriod", "cancellation", "chargebacks",
    "exceptions", "contact",
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("lastUpdated")}</p>
      </div>

      <Card className="border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/10">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{t("summary")}</p>
        </CardContent>
      </Card>

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
