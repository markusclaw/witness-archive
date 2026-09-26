import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
  { href: "/submit", label: "Submit" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo className="h-7 w-7 text-gold-500 transition group-hover:text-gold-300" />
          <span className="font-display hidden text-xl tracking-tight text-parchment-50 min-[420px]:inline">
            Witness Archive
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-2.5 py-1.5 text-sm text-parchment-300 sm:px-3 transition hover:bg-ink-800 hover:text-parchment-50"
            >
              {item.label}
            </Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-ink-600 sm:block" aria-hidden />
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
