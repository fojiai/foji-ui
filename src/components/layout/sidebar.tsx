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
  UserPlus,
  PhoneForwarded,
  Contact2,
  BarChart3,
  MessagesSquare,
  KanbanSquare,
  ListChecks,
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
import { companiesApi, adminCompaniesApi, type UserCompanyItem, type AdminCompanyListItem } from "@/lib/api";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  superAdminLabelKey?: string;
  hiddenForSuperAdmin?: boolean;
}

interface NavGroup {
  labelKey?: string;
  items: NavItem[];
}

/* Thirteen flat nav items is more than anyone scans — working memory holds
   about 5–7 chunks, and an unlabelled list of 13 forces a full read every
   time. Grouped by what the owner is trying to do (serve customers / manage
   customers / run the account), each group lands inside that budget. */
const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" }],
  },
  {
    labelKey: "nav.groups.service",
    items: [
      { href: "/agents", icon: Bot, labelKey: "nav.agents" },
      { href: "/inbox", icon: MessagesSquare, labelKey: "nav.inbox" },
      { href: "/handoffs", icon: PhoneForwarded, labelKey: "nav.handoffs" },
      { href: "/leads", icon: UserPlus, labelKey: "nav.leads" },
    ],
  },
  {
    labelKey: "nav.groups.customers",
    items: [
      { href: "/crm/contacts", icon: Contact2, labelKey: "nav.contacts" },
      { href: "/crm/pipeline", icon: KanbanSquare, labelKey: "nav.pipeline" },
      { href: "/crm/tasks", icon: ListChecks, labelKey: "nav.tasks" },
      { href: "/crm/reports", icon: BarChart3, labelKey: "nav.reports" },
    ],
  },
  {
    labelKey: "nav.groups.account",
    items: [
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
    ],
  },
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
        /* The sidebar is iron in BOTH themes, so it must be styled from the
           sidebar-* tokens — page tokens like `text-muted-foreground` would
           put dark text on a dark ground in light mode. */
        "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium transition-all duration-200",
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
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
  const [adminCompanies, setAdminCompanies] = useState<AdminCompanyListItem[]>([]);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      companiesApi.mine().then(setCompanies).catch(() => {});
    }
    if (user && isSuperAdmin) {
      adminCompaniesApi.list(undefined, 1, 100)
        .then((res) => setAdminCompanies(res.items))
        .catch(() => {});
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

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !(isSuperAdmin && item.hiddenForSuperAdmin)),
  })).filter((g) => g.items.length > 0);

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
            <span className="type-display text-lg text-sidebar-foreground">Foji AI</span>
          )}
        </Link>
        {showToggle && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
                className="mt-2 h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={onToggle}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.expandMenu")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Company switcher — regular users */}
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
            <SelectTrigger className="h-9 w-full border-sidebar-border bg-sidebar-accent/60 text-sm text-sidebar-foreground">
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

      {/* Company switcher — super admin (act as any company) */}
      {isSuperAdmin && !isCollapsed && adminCompanies.length > 0 && (
        <div className="px-3 py-2">
          <Select
            value={activeCompanyId ? String(activeCompanyId) : ""}
            onValueChange={(v) => {
              switchCompany(Number(v));
              window.location.reload();
            }}
          >
            <SelectTrigger className="h-9 w-full border-sidebar-border bg-sidebar-accent/60 text-sm text-sidebar-foreground">
              <SelectValue placeholder={t("superAdmin.selectCompany")} />
            </SelectTrigger>
            <SelectContent>
              {adminCompanies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {visibleGroups.map((group, gi) => (
          <div key={group.labelKey ?? `group-${gi}`} className={cn(gi > 0 && "mt-5")}>
            {group.labelKey &&
              (isCollapsed ? (
                // Collapsed: the label has nowhere to go, so the grouping is
                // carried by a rule instead of disappearing entirely.
                <div className="mx-2 mb-2 h-px bg-sidebar-border" />
              ) : (
                <p className="type-label mb-2 px-3 text-sidebar-foreground/40">
                  {t(group.labelKey)}
                </p>
              ))}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
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
          </div>
        ))}

        {/* Admin section */}
        {isSuperAdmin && (
          <>
            <div className="mx-1 my-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            {!isCollapsed && (
              <div className="mb-2 flex items-center gap-2 px-3">
                <Shield className="h-3.5 w-3.5 text-sidebar-primary" />
                <span className="type-label text-sidebar-primary">
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
            "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent",
            isCollapsed && "justify-center px-0"
          )}
          onClick={() => setSettingsOpen(true)}
        >
          <div className="type-readout flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-sm font-semibold text-sidebar-primary">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-sidebar-foreground/55">
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
        <span className="type-display text-base">Foji AI</span>
      </div>
    </header>
  );
}
