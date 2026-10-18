"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The phone's bottom tab bar: the five sections, always in thumb reach. On a
 * Bible chapter page the chapter bar takes its place. Sets --wa-bottom so the
 * mini player can sit above it.
 */
const TABS: { href: string; label: string; match: RegExp; icon: React.ReactNode }[] = [
  {
    href: "/ask",
    label: "Ask",
    match: /^\/ask/,
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.4A8 8 0 1 1 21 12zM9.5 10a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 16.5v.5" />,
  },
  {
    href: "/archive",
    label: "Archive",
    match: /^\/(archive|testimony|collections|author|following)|^\/[a-z]{2}\/testimony/,
    icon: <path d="M4 5h16v4H4zM5 9v10h14V9M10 13h4" />,
  },
  {
    href: "/pray",
    label: "Pray",
    match: /^\/pray/,
    icon: <path d="M12 3c-1 3-3 5-3 8.5a3 3 0 0 0 6 0C15 8 13 6 12 3zM8 21c1.2-2 2.6-3 4-3s2.8 1 4 3" />,
  },
  {
    href: "/bible",
    label: "Bible",
    match: /^\/bible/,
    icon: <path d="M12 6c-1.5-1.5-4-2-8-2v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2V4c-4 0-6.5.5-8 2zM12 6v14" />,
  },
  {
    href: "/submit",
    label: "Write",
    match: /^\/(submit|me|settings)/,
    icon: <path d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4" />,
  },
];

export default function TabBar() {
  const pathname = usePathname();
  const onChapterPage = /^\/bible\/[^/]+\/\d+/.test(pathname);

  useEffect(() => {
    if (onChapterPage) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => document.documentElement.style.setProperty("--wa-bottom", mq.matches ? "4rem" : "0px");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.setProperty("--wa-bottom", "0px");
    };
  }, [onChapterPage]);

  if (onChapterPage) return null;
  return (
    <>
      <div className="h-16 sm:hidden" aria-hidden />
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <ul className="flex h-16 items-stretch">
          {TABS.map((t) => {
            const active = t.match.test(pathname);
            return (
              <li key={t.href} className="flex-1">
                <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex h-full flex-col items-center justify-center gap-1 text-[0.65rem] font-medium tracking-wide ${active ? "text-gold-300" : "text-parchment-500 active:text-parchment-200"}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {t.icon}
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
