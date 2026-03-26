import { redirect } from "next/navigation";

// Root locale page — redirect to dashboard (middleware handles unauth → login)
export default function LocaleRootPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard`);
}
