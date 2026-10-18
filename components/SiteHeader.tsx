import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import Logo from "@/components/Logo";
import MobileNav from "@/components/MobileNav";

const NAV: { href: string; label: string }[] = [
  { href: "/ask", label: "Ask" },
  { href: "/archive", label: "Archive" },
  { href: "/pray", label: "Pray" },
  { href: "/bible", label: "Bible" },
  { href: "/submit", label: "Write" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/80 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/" className="group flex items-center gap-3">
          <Logo className="h-7 w-7 text-gold-500 transition group-hover:text-gold-300" />
          <span className="font-display text-xl tracking-tight text-parchment-50">Witness Archive</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Primary" className="hidden items-center gap-2 sm:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-1.5 text-sm text-parchment-300 transition hover:bg-ink-800 hover:text-parchment-50">
                {item.label}
              </Link>
            ))}
            <span className="mx-1 h-5 w-px bg-ink-600" aria-hidden />
          </nav>
          <AuthNav />
          <MobileNav items={[...NAV, { href: "/about", label: "About" }]} />
        </div>
      </div>
    </header>
  );
}
