"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flame, CheckCircle2, XCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function VerifyEmailPage() {
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

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {status === "loading" ? (
            <Flame className="h-6 w-6 text-primary" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <CardTitle>
          {status === "loading" && "Verifying your email…"}
          {status === "success" && "Email verified!"}
          {status === "error" && "Verification failed"}
        </CardTitle>
        <CardDescription>
          {status === "loading" && <LoadingSpinner size="sm" />}
          {status === "success" && "Your account is now active. Sign in to get started."}
          {status === "error" && "The link is invalid or has expired. Request a new one by signing up again."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status !== "loading" && (
          <Button asChild className="w-full">
            <Link href="/login">{status === "success" ? "Sign in" : "Back to sign in"}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
