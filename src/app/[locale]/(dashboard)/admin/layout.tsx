"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, CreditCard, Users, BarChart2, Building2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { PageLoader } from "@/components/shared/loading-spinner";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/admin", icon: BarChart2, labelKey: "admin.title", exact: true },
  { href: "/admin/companies", icon: Building2, labelKey: "admin.companies.title" },
  { href: "/admin/models", icon: Cpu, labelKey: "admin.models.title" },
  { href: "/admin/plans", icon: CreditCard, labelKey: "admin.plans.title" },
  { href: "/admin/invitations", icon: Users, labelKey: "admin.invitations.title" },
];

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const t = useTranslations();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user?.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) return <PageLoader />;
  if (!user?.isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1>
      </div>

      {/* Sub-nav */}
      <nav className="flex gap-1 border-b pb-0">
        {ADMIN_TABS.map((tab) => {
          const active = tab.exact
            ? pathname.endsWith("/admin")
            : pathname.includes(tab.href) && !tab.exact;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
