"use client";

import { useState, useEffect } from "react";
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
  MessageSquare,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserSettingsModal } from "@/components/layout/user-settings-modal";
import { companiesApi, type UserCompanyItem } from "@/lib/api";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  superAdminLabelKey?: string;
  hiddenForSuperAdmin?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/agents", icon: Bot, labelKey: "nav.agents" },
  {
    href: "/team",
    icon: Users,
    labelKey: "nav.team",
    superAdminLabelKey: "superAdmin.platformTeam",
  },
  {
    href: "/billing",
    icon: CreditCard,
    labelKey: "nav.billing",
    superAdminLabelKey: "superAdmin.manageSubscriptions",
  },
  {
    href: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    hiddenForSuperAdmin: true,
  },
  { href: "/contact", icon: MessageSquare, labelKey: "nav.contact" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", icon: Shield, labelKey: "nav.admin" },
];

function NavLink({
  item,
  locale,
  isActive,
  isCollapsed,
  isSuperAdmin,
  onNavigate,
  t,
}: {
  item: NavItem;
  locale: string;
  isActive: boolean;
  isCollapsed: boolean;
  isSuperAdmin: boolean;
  onNavigate?: () => void;
  t: (key: string) => string;
}) {
  const label =
    isSuperAdmin && item.superAdminLabelKey
      ? t(item.superAdminLabelKey)
      : t(item.labelKey);

  const link = (
    <Link
      href={`/${locale}${item.href}`}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 h-11 text-base font-medium transition-all duration-200",
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary" />
      )}
      <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed && "h-5 w-5")} />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarContent({
  locale,
  isCollapsed,
  onToggle,
  onNavigate,
  showToggle,
}: {
  locale: string;
  isCollapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  showToggle?: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, activeCompanyId, switchCompany } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [companies, setCompanies] = useState<UserCompanyItem[]>([]);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      companiesApi.mine().then(setCompanies).catch(() => {});
    }
  }, [user, isSuperAdmin]);

  function isActive(href: string) {
    const full = `/${locale}${href}`;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() ?? "?";

  const visibleMainNav = MAIN_NAV.filter(
    (item) => !(isSuperAdmin && item.hiddenForSuperAdmin)
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo + collapse toggle */}
      <div className={cn("flex h-16 items-center", isCollapsed ? "justify-center px-2" : "justify-between px-5")}>
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
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight">Foji AI</span>
          )}
        </Link>
        {showToggle && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
        {showToggle && isCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground mt-2"
                onClick={onToggle}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Company switcher */}
      {!isSuperAdmin && !isCollapsed && (
        <div className="px-3 py-2">
          <Select
            value={activeCompanyId ? String(activeCompanyId) : ""}
            onValueChange={(v) => {
              if (v === "__create__") {
                window.location.href = `/${locale}/onboarding`;
              } else {
                switchCompany(Number(v));
                window.location.reload();
              }
            }}
          >
            <SelectTrigger className="h-9 w-full text-sm bg-sidebar-accent/50 border-sidebar-border">
              <SelectValue placeholder={t("emptyStates.noCompanyTitle")} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.companyId} value={String(c.companyId)}>
                  {c.companyName || `Company #${c.companyId}`}
                </SelectItem>
              ))}
              <SelectItem value="__create__">
                + {t("onboarding.createCompany")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-1">
          {visibleMainNav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              locale={locale}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
              isSuperAdmin={isSuperAdmin}
              onNavigate={onNavigate}
              t={t}
            />
          ))}
        </div>

        {/* Admin section */}
        {isSuperAdmin && (
          <>
            <div className="mx-1 my-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            {!isCollapsed && (
              <div className="mb-2 flex items-center gap-2 px-3">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                  Admin
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  locale={locale}
                  isActive={isActive(item.href)}
                  isCollapsed={isCollapsed}
                  isSuperAdmin={isSuperAdmin}
                  onNavigate={onNavigate}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      <div className="p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 cursor-pointer transition-colors hover:bg-accent",
            isCollapsed && "justify-center px-0"
          )}
          onClick={() => setSettingsOpen(true)}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
                {t("nav.settings")}
                <ChevronRight className="h-3 w-3" />
              </p>
            </div>
          )}
        </div>
      </div>

      <UserSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export function Sidebar({
  locale,
  isCollapsed,
  onToggle,
}: {
  locale: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed z-50 top-0 left-0 bottom-0 bg-sidebar border border-sidebar-border transition-[width] duration-300 ease-in-out hidden lg:flex lg:flex-col",
        "lg:top-3 lg:left-3 lg:bottom-3 lg:rounded-2xl lg:shadow-xl dark:lg:shadow-[0_0_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/[0.06]",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      <SidebarContent
        locale={locale}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        showToggle
      />
    </aside>
  );
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent locale={locale} isCollapsed={false} onNavigate={onClose} />
      </aside>
    </>
  );
}

export function MobileHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
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
