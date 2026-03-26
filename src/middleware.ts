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

  // Auth guard: redirect to login if no token and not a public path
  if (!isPublicPath(pathname)) {
    const token = request.cookies.get("foji_token")?.value;
    if (!token) {
      const loginUrl = new URL(
        `/${routing.defaultLocale}/login`,
        request.url
      );
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
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
