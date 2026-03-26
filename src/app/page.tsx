import { redirect } from "next/navigation";

// App root → redirect to default locale
export default function RootPage() {
  redirect("/pt-br/login");
}
