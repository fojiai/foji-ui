"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { whatsAppOnboardingApi, apiErrorMessage, type WhatsAppOnboardingConfig } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/**
 * One-click WhatsApp connection.
 *
 * The customer clicks once, picks their number inside Meta's own popup, and is
 * done. Everything they used to have to do by hand — creating a System User,
 * generating a permanent token, copying a phone_number_id, subscribing the
 * WABA to webhooks, registering the number with a PIN — happens server-side
 * off the back of a single 30-second code.
 */

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (cb: (r: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FbLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}

/** What Meta posts back to us as the customer moves through the flow. */
interface EmbeddedSignupPayload {
  type: string;
  event: "FINISH" | "CANCEL" | "ERROR" | string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    current_step?: string;
    error_message?: string;
  };
}

const SDK_SCRIPT_ID = "foji-facebook-jssdk";
/** How long to wait for Meta's popup before assuming it never opened. */
const POPUP_TIMEOUT_MS = 90_000;

export function ConnectWhatsAppButton({
  companyId,
  agentId,
  onConnected,
}: {
  companyId: number;
  agentId: number;
  onConnected: (result: { phoneNumberId: string; displayPhoneNumber?: string | null }) => void;
}) {
  const t = useTranslations();
  const [config, setConfig] = useState<WhatsAppOnboardingConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [busy, setBusy] = useState(false);
  const stuckTimer = useRef<number | null>(null);

  /** Meta sends the ids over postMessage, the code arrives via the callback.
   *  They race, so we stash the ids and act once we hold both halves. */
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  useEffect(() => {
    whatsAppOnboardingApi.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  // Load Meta's SDK only when we actually have something to launch — no
  // third-party script on the page for customers who will never use it.
  useEffect(() => {
    if (!config?.enabled || !config.appId) return;

    // Readiness means window.FB exists and is initialised — not merely that a
    // <script> tag is on the page. Those are different moments, and treating
    // them as the same enables the button while FB is still undefined.
    let cancelled = false;
    function markReadyWhenLoaded() {
      if (cancelled) return;
      if (window.FB) { setSdkReady(true); return; }
      window.setTimeout(markReadyWhenLoaded, 150);
    }

    if (document.getElementById(SDK_SCRIPT_ID)) {
      markReadyWhenLoaded();
      return () => { cancelled = true; };
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: config.graphVersion,
      });
      if (!cancelled) setSdkReady(true);
    };

    const script = document.createElement("script");
    script.id = SDK_SCRIPT_ID;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      console.error("[whatsapp] Meta's SDK failed to load — check for a blocker on connect.facebook.net");
      if (!cancelled) { setSdkReady(false); setSdkError(true); }
    };
    document.body.appendChild(script);

    return () => { cancelled = true; };
  }, [config]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only Meta may talk to us here.
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      let payload: EmbeddedSignupPayload;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return; // not ours
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "FINISH") {
        signupData.current = {
          wabaId: payload.data?.waba_id,
          phoneNumberId: payload.data?.phone_number_id,
        };
      } else if (payload.event === "CANCEL") {
        setBusy(false);
        toast({ title: t("agents.whatsapp.connectCancelled") });
      } else if (payload.event === "ERROR") {
        setBusy(false);
        toast({
          variant: "destructive",
          title: payload.data?.error_message || t("errors.generic"),
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [t]);

  const launch = useCallback(() => {
    if (!window.FB) {
      console.error("[whatsapp] window.FB is not available — Meta's SDK did not load.");
      toast({ variant: "destructive", title: t("agents.whatsapp.sdkUnavailable") });
      return;
    }
    if (!config?.configId) {
      console.error("[whatsapp] No Meta:EmbeddedSignupConfigId configured on the server.");
      toast({ variant: "destructive", title: t("agents.whatsapp.notConfigured") });
      return;
    }

    setBusy(true);
    signupData.current = {};

    // ── Bug 3: if Meta's popup is blocked, FB.login's callback never fires and
    // the button stays disabled forever. Release it and say why.
    if (stuckTimer.current) window.clearTimeout(stuckTimer.current);
    stuckTimer.current = window.setTimeout(() => {
      setBusy((wasBusy) => {
        if (wasBusy) {
          console.warn("[whatsapp] Meta never called back — popup blocked, or the window was closed.");
          toast({ variant: "destructive", title: t("agents.whatsapp.popupBlocked") });
        }
        return false;
      });
    }, POPUP_TIMEOUT_MS);

    // The callback passed to FB.login must be a plain function. Meta's SDK
    // inspects it and rejects an async one with "Expression is of type
    // asyncfunction, not function", which surfaces as a click that does
    // nothing at all.
    const onLoginResponse = (response: FbLoginResponse) => {
      void handleLoginResponse(response);
    };

    const handleLoginResponse = async (response: FbLoginResponse) => {
        if (stuckTimer.current) window.clearTimeout(stuckTimer.current);

        const code = response?.authResponse?.code;
        if (!code) {
          // Closing the popup is a normal thing to do, so this is not an error.
          console.info("[whatsapp] Flow closed without a code", response?.status);
          setBusy(false);
          return;
        }

        const { wabaId, phoneNumberId } = signupData.current;
        if (!wabaId || !phoneNumberId) {
          // Almost always the app's Allowed Domains / OAuth redirect URIs not
          // listing this exact origin — Meta then withholds the ids.
          console.error(
            "[whatsapp] Meta returned a code but no waba_id/phone_number_id. " +
            "Check Allowed Domains and Valid OAuth Redirect URIs both list " + window.location.origin
          );
          setBusy(false);
          toast({ variant: "destructive", title: t("agents.whatsapp.connectIncomplete") });
          return;
        }

        try {
          // The code expires in ~30s, so this goes straight out.
          const result = await whatsAppOnboardingApi.complete({
            companyId, agentId, code, wabaId, phoneNumberId,
          });
          toast({ title: t("agents.whatsapp.connectSuccess") });
          onConnected(result);
        } catch (err) {
          toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
        } finally {
          if (stuckTimer.current) window.clearTimeout(stuckTimer.current);
          setBusy(false);
        }
    };

    window.FB.login(onLoginResponse, {
      config_id: config.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
    });
  }, [config, companyId, agentId, onConnected, t]);

  // Not configured on this deployment — the caller falls back to manual setup.
  if (!config?.enabled) return null;

  if (sdkError) {
    return (
      <p className="text-xs text-spark-ink">{t("agents.whatsapp.sdkUnavailable")}</p>
    );
  }

  return (
    <Button type="button" onClick={launch} disabled={!sdkReady || busy}>
      {busy ? <LoadingSpinner size="sm" className="mr-2" /> : <MessageCircle className="mr-2 h-4 w-4" />}
      {t("agents.whatsapp.connectButton")}
    </Button>
  );
}
