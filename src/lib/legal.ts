/**
 * The marketing site (fojiai.com) is the single source of truth for legal
 * documents. The app used to ship its own copies, which had already drifted
 * from the site's (different legal frameworks, a different DPO email, different
 * retention numbers). Everything here links out to the canonical page instead,
 * so there is exactly one privacy policy and one set of terms for the company.
 *
 * The in-app routes /privacy, /legal and /data-deletion redirect to these.
 */
export const LEGAL_URLS = {
  terms: "https://fojiai.com/termos",
  privacy: "https://fojiai.com/privacidade",
  dataDeletion: "https://fojiai.com/exclusao-de-dados",
} as const;
