"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isInternal, setInternal, setUserId, setUserProperties } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4. The gtag queue + config are set up by an inline script in
 * app/layout.tsx (see `gaInitScript`) so they exist before React hydrates.
 * - Fires a page_view on every client-side navigation, not just the first load.
 * - Tags hits from the team as internal traffic (see lib/analytics.ts).
 * - Sets signed_in / user_id so reports can be split by membership.
 */
export default function Analytics({ id }: { id: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ?internal=1 / ?internal=0 flips the internal-traffic flag for this browser.
  useEffect(() => {
    const flag = searchParams.get("internal");
    if (flag === "1") setInternal(true);
    else if (flag === "0") setInternal(false);
  }, [searchParams]);

  useEffect(() => {
    if (!window.gtag) return;
    const query = searchParams.toString();
    window.gtag("event", "page_view", {
      page_path: query ? `${pathname}?${query}` : pathname,
      page_title: document.title,
      ...(isInternal() ? { traffic_type: "internal" } : {}),
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const apply = (userId: string | null) => {
      setUserId(userId);
      setUserProperties({ signed_in: userId ? "yes" : "no" });
    };
    // Fires INITIAL_SESSION on subscribe, then on every sign-in/out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
    </>
  );
}
