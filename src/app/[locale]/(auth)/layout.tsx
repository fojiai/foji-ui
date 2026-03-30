import { AuthProvider } from "@/components/providers/auth-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4">
        {/* Subtle brand glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[oklch(0.59_0.25_27)] opacity-[0.04] blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-md">
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
