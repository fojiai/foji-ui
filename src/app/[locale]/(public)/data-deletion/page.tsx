import { redirect } from "next/navigation";
import { LEGAL_URLS } from "@/lib/legal";

/**
 * Data deletion instructions live on the marketing site (fojiai.com), the
 * single source of truth and the URL registered with Meta. This route only
 * redirects old links there. Kept in middleware's PUBLIC_PATHS so the redirect
 * fires before the auth guard.
 */
export default function DataDeletionPage() {
  redirect(LEGAL_URLS.dataDeletion);
}
