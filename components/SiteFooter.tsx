import Link from "next/link";
import Logo from "@/components/Logo";
import { CATEGORIES } from "@/lib/categories";
import { CopyrightLink } from "@/components/BibleCopyright";

export default function SiteFooter() {
  return (
    <footer className="site-footer mt-12 border-t border-ink-700 bg-ink-950 sm:mt-24">
      {/* Phones: the tab bar already carries the sections, so the footer is one quiet line. */}
      <div className="flex items-center justify-between gap-4 px-5 py-5 text-xs text-parchment-700 sm:hidden">
        <span className="whitespace-nowrap">&copy; {new Date().getFullYear()}</span>
        <span className="flex gap-4 whitespace-nowrap">
          <Link href="/about" className="hover:text-gold-300">About</Link>
          <Link href="/archive" className="hover:text-gold-300">Collections</Link>
          <Link href="/bible/obt" className="hover:text-gold-300">Open Bible</Link>
        </span>
      </div>
      <div className="mx-auto hidden max-w-6xl gap-10 px-5 py-14 sm:grid md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="h-6 w-6 text-gold-500" />
            <span className="font-display text-lg text-parchment-50">Witness Archive</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-parchment-500">
            A living record of encounters with the supernatural, gathered from scattered corners of the
            internet into one place where they can be found, heard, and discussed.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Collections</p>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="text-parchment-300 hover:text-gold-300">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Archive</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/archive" className="text-parchment-300 hover:text-gold-300">Browse all</Link></li>
            <li><Link href="/about" className="text-parchment-300 hover:text-gold-300">About the project</Link></li>
            <li><Link href="/submit" className="text-parchment-300 hover:text-gold-300">Write your testimony</Link></li>
            <li><Link href="/auth" className="text-parchment-300 hover:text-gold-300">Sign in</Link></li>
            <li>
              <Link href="/bible/obt" className="text-parchment-300 hover:text-gold-300">Open Bible Translation</Link>
              <span className="ml-2 rounded border border-gold-500/40 px-1 text-[0.6rem] uppercase tracking-wider text-gold-400">Draft</span>
            </li>

          </ul>
        </div>
      </div>
      <div className="hidden border-t border-ink-800 sm:block">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-parchment-700 sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Witness Archive. Testimonies are shared with permission or embedded from their public source.</p>
          <p>
            Videos remain the property of their original creators. ·{" "}
            <CopyrightLink className="hover:text-parchment-300">Bible texts &amp; copyright</CopyrightLink>
          </p>
        </div>
      </div>
    </footer>
  );
}
