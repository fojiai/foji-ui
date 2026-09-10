import { redirect } from "next/navigation";
import { LEGAL_URLS } from "@/lib/legal";

/**
 * The privacy policy lives on the marketing site (fojiai.com), which is the
 * single source of truth. This route only exists to catch old links and send
 * them there. Kept in middleware's PUBLIC_PATHS so the redirect fires before
 * the auth guard.
 */
export default function PrivacyPage() {
  redirect(LEGAL_URLS.privacy);
}
