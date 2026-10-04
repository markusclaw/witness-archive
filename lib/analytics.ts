/**
 * Google Analytics 4 helpers.
 *
 * Every event goes through `track()` so the parameter names stay consistent
 * and so nothing breaks when GA isn't configured (local dev, ad blockers).
 *
 * Internal traffic: visits from the team are tagged `traffic_type: internal`
 * on every hit. With the "Internal Traffic" data filter active in GA (Admin →
 * Data filters), those hits never reach the reports. The flag lives in
 * localStorage, so it is per browser: turn it on once from Settings, or by
 * opening any page with `?internal=1` (`?internal=0` turns it off again).
 */

export const INTERNAL_KEY = "wa:analytics-internal";

/**
 * Inline bootstrap for the root layout's <head>: defines the gtag queue and
 * sends `config` before hydration, tagging the whole page load as internal
 * when this browser has opted out. gtag.js itself loads later and drains the queue.
 */
export function gaInitScript(id: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var waInternal=false;try{waInternal=localStorage.getItem('${INTERNAL_KEY}')==='1';}catch(e){}gtag('config','${id}',waInternal?{send_page_view:false,traffic_type:'internal'}:{send_page_view:false});`;
}

export type EventName =
  | "testimony_view"
  | "read_progress"
  | "listen_start"
  | "listen_complete"
  | "video_play"
  | "translate"
  | "share"
  | "heart"
  | "follow"
  | "ask"
  | "write_start"
  | "polish_used"
  | "polish_applied"
  | "testimony_publish"
  | "sign_up"
  | "login"
  | "prayed"
  | "prayer_request"
  | "prayer_reply"
  | "prayer_answered"
  | "scripture_open";

type Params = Record<string, string | number | boolean | null | undefined>;

export function isInternal(): boolean {
  try {
    return window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setInternal(on: boolean) {
  try {
    if (on) window.localStorage.setItem(INTERNAL_KEY, "1");
    else window.localStorage.removeItem(INTERNAL_KEY);
  } catch {
    /* storage unavailable */
  }
  // Applies to every later hit on this page; the inline init handles the next page load.
  window.gtag?.("set", { traffic_type: on ? "internal" : undefined });
}

/** Send one event. Drops undefined/null params so GA doesn't see "undefined". */
export function track(name: EventName, params: Params = {}) {
  if (typeof window === "undefined" || !window.gtag) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) clean[k] = v;
  if (isInternal()) clean.traffic_type = "internal";
  window.gtag("event", name, clean);
}

/** Per-visitor traits that every report can be split by. */
export function setUserProperties(props: Record<string, string | null>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("set", "user_properties", props);
}

/** Tie sessions across devices for signed-in members (pseudonymous uuid, no PII). */
export function setUserId(id: string | null) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("set", { user_id: id ?? undefined });
}
