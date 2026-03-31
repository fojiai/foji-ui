"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NoCompanyState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="font-medium">{t("emptyStates.noCompanyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("emptyStates.noCompanyDescription")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/onboarding`}>{t("onboarding.createCompany")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function NoPlanState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <Card className="border-yellow-400/50">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
          <CreditCard className="h-7 w-7 text-yellow-600" />
        </div>
        <div>
          <p className="font-medium">{t("emptyStates.noPlanTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("emptyStates.noPlanDescription")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/billing`}>{t("emptyStates.subscribePlan")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function TrialExpiredState() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="font-medium">{t("emptyStates.trialExpiredTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("emptyStates.trialExpiredDescription")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/billing`}>{t("emptyStates.subscribePlan")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
