import { redirect } from "next/navigation";

// Root locale page — redirect to dashboard (middleware handles unauth → login)
export default async function LocaleRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
