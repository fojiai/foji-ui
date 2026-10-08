"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { apiFetch, apiErrorMessage, ApiError, type LoginResponse } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { passwordSchema } from "@/lib/validations/password";
import { toast } from "@/hooks/use-toast";

/** GET /api/invitations/{token} */
interface CompanyInvitePreview {
  email: string;
  companyId: number;
  companyName: string;
  inviterName: string;
  role: "admin" | "user";
  expiresAt: string;
  /** A verified account already uses this email — log in instead of signing up. */
  accountExists: boolean;
}

/** GET /api/admin/invitations/preview?token= */
interface AdminInvitePreview {
  email: string;
  invitedBy: string;
  expiresAt: string;
}

/** POST /api/invitations/{token}/accept */
interface AcceptInvitationResponse {
  message: string;
  newToken: string;
  companyId: number;
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  password: passwordSchema,
});
type RegisterData = z.infer<typeof registerSchema>;

const loginSchema = z.object({ password: z.string().min(1) });
type LoginData = z.infer<typeof loginSchema>;

export default function AcceptInvitationPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading, login, adoptToken } = useAuth();

  const token = params.get("token") ?? "";
  const isAdminInvite = params.get("type") === "admin";
  const encodedToken = encodeURIComponent(token);

  const [companyInvite, setCompanyInvite] = useState<CompanyInvitePreview | null>(null);
  const [adminInvite, setAdminInvite] = useState<AdminInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  // Starts from the preview; flips to "login" if the account turns up at signup time.
  const [mode, setMode] = useState<"register" | "login">("register");
  // Set once the invite is accepted, so the card doesn't flip to the signed-in view before the redirect lands.
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!token) { setPreviewLoading(false); return; }
    const load = isAdminInvite
      ? apiFetch<AdminInvitePreview>(`/api/admin/invitations/preview?token=${encodedToken}`).then(setAdminInvite)
      : apiFetch<CompanyInvitePreview>(`/api/invitations/${encodedToken}`).then((p) => {
          setCompanyInvite(p);
          setMode(p.accountExists ? "login" : "register");
        });
    load.catch(() => undefined).finally(() => setPreviewLoading(false));
  }, [token, encodedToken, isAdminInvite]);

  function joined(newToken: string, companyId: number, companyName: string) {
    setRedirecting(true);
    adoptToken(newToken, companyId);
    toast({ title: t("acceptInvitation.joined", { company: companyName }) });
    router.push("/dashboard");
  }

  async function acceptAsCurrentUser(invite: CompanyInvitePreview) {
    const resp = await apiFetch<AcceptInvitationResponse>(`/api/invitations/${encodedToken}/accept`, {
      method: "POST",
    });
    joined(resp.newToken, resp.companyId, invite.companyName);
  }

  async function registerAndJoin(data: RegisterData) {
    if (!companyInvite) return;
    try {
      const resp = await apiFetch<LoginResponse>(`/api/invitations/${encodedToken}/register`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      joined(resp.token, companyInvite.companyId, companyInvite.companyName);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMode("login");
        toast({ title: t("acceptInvitation.accountExistsHint") });
        return;
      }
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  async function loginAndJoin(data: LoginData) {
    if (!companyInvite) return;
    try {
      await login(companyInvite.email, data.password);
      await acceptAsCurrentUser(companyInvite);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  async function joinSignedIn() {
    if (!companyInvite) return;
    try {
      await acceptAsCurrentUser(companyInvite);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  async function createAdminAccount(data: RegisterData) {
    try {
      await apiFetch(`/api/admin/invitations/accept`, {
        method: "POST",
        body: JSON.stringify({ token, ...data }),
      });
      // This endpoint doesn't sign anyone in — send them to log in with the new account.
      setRedirecting(true);
      toast({ title: t("acceptInvitation.adminCreated") });
      router.push("/login");
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  if (redirecting) return (
    <Card className="w-full max-w-md text-center p-8">
      <LoadingSpinner size="lg" />
    </Card>
  );

  if (previewLoading || authLoading) return (
    <Card className="w-full max-w-md text-center p-8">
      <LoadingSpinner size="lg" label={t("acceptInvitation.loading")} />
    </Card>
  );

  const email = companyInvite?.email ?? adminInvite?.email;
  if (!email) return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>{t("acceptInvitation.invalidTitle")}</CardTitle>
        <CardDescription>{t("acceptInvitation.invalidDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("auth.login")}</Link>
        </Button>
      </CardContent>
    </Card>
  );

  const signedInAsInvitee = !!user && user.email.toLowerCase() === email.toLowerCase();
  const signedInAsSomeoneElse = !!user && !signedInAsInvitee;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Image src="/logo-icon.png" alt="Foji AI" width={80} height={80} className="mx-auto rounded-lg" priority />
        </div>
        <CardTitle>{t("acceptInvitation.title")}</CardTitle>
        <CardDescription>
          {companyInvite
            ? t("acceptInvitation.companyDescription", {
                inviter: companyInvite.inviterName,
                company: companyInvite.companyName,
                role: t(`team.roles.${companyInvite.role}`),
              })
            : t("acceptInvitation.adminDescription", { inviter: adminInvite!.invitedBy })}
          <br />
          <span className="font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signedInAsSomeoneElse && !isAdminInvite && (
          <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            {t("acceptInvitation.signedInAsOther", { current: user!.email, invited: email })}
          </p>
        )}

        {isAdminInvite ? (
          <RegisterForm submitLabel={t("acceptInvitation.createAdminAccount")} onSubmit={createAdminAccount} />
        ) : signedInAsInvitee ? (
          <JoinSignedIn onJoin={joinSignedIn} />
        ) : mode === "login" ? (
          <LoginForm email={email} onSubmit={loginAndJoin} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("acceptInvitation.createAccountHint")}</p>
            <RegisterForm submitLabel={t("acceptInvitation.createAndJoin")} onSubmit={registerAndJoin} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (data: RegisterData) => Promise<void> }) {
  const t = useTranslations();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });
  const passwordValue = watch("password", "");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t("auth.firstName")}</Label>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} aria-invalid={!!errors.firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t("auth.lastName")}</Label>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} aria-invalid={!!errors.lastName} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
        <PasswordRequirements password={passwordValue} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function LoginForm({ email, onSubmit }: { email: string; onSubmit: (data: LoginData) => Promise<void> }) {
  const t = useTranslations();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("acceptInvitation.loginHint")}</p>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" type="email" autoComplete="username" value={email} readOnly disabled />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
        {t("acceptInvitation.loginAndJoin")}
      </Button>
    </form>
  );
}

function JoinSignedIn({ onJoin }: { onJoin: () => Promise<void> }) {
  const t = useTranslations();
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    try { await onJoin(); } finally { setJoining(false); }
  }

  return (
    <Button className="w-full" disabled={joining} onClick={join}>
      {joining && <LoadingSpinner size="sm" className="mr-2" />}
      {t("acceptInvitation.join")}
    </Button>
  );
}
