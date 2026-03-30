"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Sidebar, MobileSidebar, MobileHeader } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-sidebar">
          <Sidebar locale={locale} />
        </aside>

        {/* Mobile sidebar */}
        <MobileSidebar
          locale={locale}
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          <MobileHeader onMenuToggle={() => setMobileOpen((o) => !o)} />
          <main className="flex-1 overflow-y-auto bg-muted/40 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
