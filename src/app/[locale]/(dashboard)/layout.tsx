"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Sidebar, MobileSidebar, MobileHeader } from "@/components/layout/sidebar";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCollapsed, toggle } = useSidebarCollapse();

  return (
    <AuthProvider>
      {/* Desktop floating sidebar */}
      <Sidebar locale={locale} isCollapsed={isCollapsed} onToggle={toggle} />

      {/* Mobile sidebar */}
      <MobileSidebar
        locale={locale}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main content */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-[margin-left] duration-300 ease-in-out",
          isCollapsed ? "lg:ml-[96px]" : "lg:ml-[280px]"
        )}
      >
        <MobileHeader onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 bg-muted/40 p-4 sm:p-6 lg:p-8 lg:mt-3 lg:mr-3 lg:mb-3 lg:rounded-2xl">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
