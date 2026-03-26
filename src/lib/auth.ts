/**
 * Client-side auth utilities — JWT stored in an httpOnly-like cookie
 * set by the login API response and cleared on logout.
 */

export interface JwtClaims {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  companies: Array<{ companyId: number; role: "owner" | "admin" | "user" }>;
  exp: number;
}

export function parseToken(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload)) as JwtClaims;
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  // 7-day expiry; use Secure + SameSite in production (set by API)
  document.cookie = `foji_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  localStorage.setItem("foji_token", token);
}

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("foji_token");
}

export function clearToken() {
  document.cookie = "foji_token=; path=/; max-age=0";
  localStorage.removeItem("foji_token");
  localStorage.removeItem("foji_active_company");
}

export function getActiveCompanyId(): number | null {
  const raw = localStorage.getItem("foji_active_company");
  return raw ? parseInt(raw, 10) : null;
}

export function setActiveCompanyId(id: number) {
  localStorage.setItem("foji_active_company", String(id));
}

export function getCurrentUser(): JwtClaims | null {
  const token = getToken();
  if (!token) return null;
  const claims = parseToken(token);
  if (!claims || claims.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return claims;
}
