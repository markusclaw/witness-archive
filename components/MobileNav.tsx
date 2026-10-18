"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The phone menu: one button in the header that opens the site's sections as
 * a full-width sheet under the header. On larger screens the links sit in
 * the header itself and this renders nothing.
 */
export default function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Menu"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-parchment-200 transition hover:bg-ink-800 sm:hidden"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 top-[57px] z-40 bg-ink-950/50 sm:hidden" />
          <nav id="mobile-nav" aria-label="Primary" className="absolute inset-x-0 top-full z-50 border-b border-ink-700 bg-ink-950/95 px-4 pb-4 pt-2 backdrop-blur-md sm:hidden">
            <ul>
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) || (item.href === "/bible" && pathname.startsWith("/bible"));
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`font-display block border-b border-ink-800 py-3.5 text-2xl ${active ? "text-gold-300" : "text-parchment-100"}`}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
