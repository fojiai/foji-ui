"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Users,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/agents", icon: Bot, labelKey: "nav.agents" },
  { href: "/files", icon: FileText, labelKey: "nav.files" },
  { href: "/team", icon: Users, labelKey: "nav.team" },
  { href: "/billing", icon: CreditCard, labelKey: "nav.billing" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
  { href: "/admin", icon: Shield, labelKey: "nav.admin", adminOnly: true },
];

export function Sidebar({ locale }: { locale: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, activeCompanyId, logout } = useAuth();

  function isActive(href: string) {
    const full = `/${locale}${href}`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo3_foji.png" alt="Foji AI" className="h-8" />
      </div>

      {/* Company switcher (placeholder — expand as needed) */}
      {activeCompanyId && (
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-muted-foreground">Company #{activeCompanyId}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.isSuperAdmin).map((item) => (
            <li key={item.href}>
              <Link
                href={`/${locale}${item.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <Separator />
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {user?.firstName?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </aside>
  );
}
