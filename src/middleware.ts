import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/legal",
  "/privacy",
  "/refund",
];

function isPublicPath(pathname: string): boolean {
  // Strip locale prefix (e.g. /pt-br/login → /login)
  const stripped = pathname.replace(/^\/(pt-br|en|es)/, "") || "/";
  return PUBLIC_PATHS.some((p) => stripped === p || stripped.startsWith(p + "?"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run intl middleware first
  const response = intlMiddleware(request);

  // Auth guard: redirect to login if no token (or expired) and not a public path
  if (!isPublicPath(pathname)) {
    const token = request.cookies.get("foji_token")?.value;
    let valid = false;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        valid = typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
      } catch {
        // malformed token — treat as invalid
      }
    }
    if (!valid) {
      // Clear the expired/invalid cookie so the client doesn't loop
      const loginUrl = new URL(
        `/${routing.defaultLocale}/login`,
        request.url
      );
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.cookies.set("foji_token", "", { path: "/", maxAge: 0 });
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    "/((?!_next|_vercel|api|favicon\\.ico|manifest\\.json|icons|.*\\..*).*)",
  ],
};
