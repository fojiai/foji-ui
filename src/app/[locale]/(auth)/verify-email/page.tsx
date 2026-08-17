"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function VerifyEmailPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    authApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  // Waiting and success are both good news, so they stay warm — only a dead
  // link is styled as a failure.
  if (status === "error") {
    return (
      <div className="w-full max-w-lg">
        <EmptyState
          tone="stop"
          eyebrow={t("verifyEmail.eyebrow")}
          title={t("verifyEmail.errorTitle")}
          description={t("verifyEmail.errorDescription")}
          action={
            <Button asChild>
              <Link href="/login">{t("verifyEmail.backToSignIn")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <EmptyState
        eyebrow={t("verifyEmail.eyebrow")}
        title={status === "loading" ? t("verifyEmail.loadingTitle") : t("verifyEmail.successTitle")}
        description={
          status === "loading"
            ? t("verifyEmail.loadingDescription")
            : t("verifyEmail.successDescription")
        }
        action={
          status === "loading" ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Button asChild>
              <Link href="/login">{t("verifyEmail.signIn")}</Link>
            </Button>
          )
        }
      />
    </div>
  );
}
