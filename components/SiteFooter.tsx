import Link from "next/link";
import Logo from "@/components/Logo";
import { CATEGORIES } from "@/lib/categories";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink-700 bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
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
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-parchment-700 sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Witness Archive. Testimonies are shared with permission or embedded from their public source.</p>
          <p>Videos remain the property of their original creators.</p>
        </div>
      </div>
    </footer>
  );
}
