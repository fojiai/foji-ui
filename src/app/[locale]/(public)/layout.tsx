import Link from "next/link";
import Image from "next/image";

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="Foji AI" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-lg">Foji AI</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/refund" className="hover:text-foreground transition-colors">Refund</Link>
            <Link href="/login" className="text-primary hover:underline font-medium">Login</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} P2 TECH INOVA SIMPLES (I.S.) — CNPJ 52.417.209/0001-59</p>
          <nav className="flex gap-4">
            <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/refund" className="hover:text-foreground transition-colors">Refund</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
