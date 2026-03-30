"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Bot,
  Users,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/agents", icon: Bot, labelKey: "nav.agents" },
  { href: "/team", icon: Users, labelKey: "nav.team" },
  { href: "/billing", icon: CreditCard, labelKey: "nav.billing" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", icon: Shield, labelKey: "nav.admin" },
];

function SidebarContent({
  locale,
  onNavigate,
}: {
  locale: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, activeCompanyId, logout } = useAuth();

  function isActive(href: string) {
    const full = `/${locale}${href}`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-5">
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-3 transition-transform hover:scale-[1.02]"
          onClick={onNavigate}
        >
          <Image
            src="/logo-icon.png"
            alt="Foji AI"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight">Foji AI</span>
        </Link>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Company context */}
      {activeCompanyId && (
        <div className="px-5 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Company #{activeCompanyId}
          </span>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {t(item.labelKey)}
            </Link>
          ))}
        </div>

        {/* Admin section */}
        {user?.isSuperAdmin && (
          <>
            <div className="mx-1 my-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            <div className="mb-2 flex items-center gap-2 px-3">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Admin
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => { logout(); onNavigate?.(); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ locale }: { locale: string }) {
  return <SidebarContent locale={locale} />;
}

export function MobileSidebar({
  locale,
  isOpen,
  onClose,
}: {
  locale: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent locale={locale} onNavigate={onClose} />
      </aside>
    </>
  );
}

export function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <Image
          src="/logo-icon.png"
          alt="Foji AI"
          width={24}
          height={24}
          className="rounded"
        />
        <span className="font-bold">Foji AI</span>
      </div>
    </header>
  );
}
