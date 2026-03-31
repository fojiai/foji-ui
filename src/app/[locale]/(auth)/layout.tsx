import Link from "next/link";
import { AuthProvider } from "@/components/providers/auth-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4">
        {/* Subtle brand glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[oklch(0.59_0.25_27)] opacity-[0.04] blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          {children}
        </div>
        {/* Footer links */}
        <nav className="relative z-10 mt-8 flex gap-4 text-xs text-zinc-500">
          <Link href="/legal" className="hover:text-zinc-300 transition-colors">Legal</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
          <Link href="/refund" className="hover:text-zinc-300 transition-colors">Refund</Link>
        </nav>
      </div>
    </AuthProvider>
  );
}
