import { redirect } from "next/navigation";
import { LEGAL_URLS } from "@/lib/legal";

/**
 * The Terms of Use live on the marketing site (fojiai.com), the single source
 * of truth. This route only redirects old links there. Kept in middleware's
 * PUBLIC_PATHS so the redirect fires before the auth guard.
 */
export default function LegalPage() {
  redirect(LEGAL_URLS.terms);
}
