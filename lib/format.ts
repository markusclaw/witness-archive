export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = seconds;
  for (const [step, unit] of units) {
    if (Math.abs(value) < step) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.round(value), unit);
    }
    value = value / step;
  }
  return formatDate(iso);
}

/** Split long-form text into paragraphs on blank lines (or single newlines as a fallback). */
export function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  const byBlank = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  return text.split(/\n/).map((p) => p.trim()).filter(Boolean);
}

/** Rough reading time for a transcript. */
export function readingTime(text: string | null | undefined): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

/** A stable "catalog number" for an id, purely cosmetic — gives the archive its ledger feel. */
export function catalogNumber(id: string): string {
  const hex = id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `WA-${hex}`;
}

/** "April 1999", "1999", "around 1999", or a full date, depending on how precise the author was. */
export function formatExperienced(iso: string, precision: "day" | "month" | "year" | "approx" = "day"): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (precision === "day") return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (precision === "month") return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  if (precision === "year") return String(d.getFullYear());
  return `around ${d.getFullYear()}`;
}

/** "Queens, New York, United States" from whatever parts exist. */
export function formatLocation(t: { location_city?: string | null; location_region?: string | null; location_country?: string | null; location_text?: string | null }): string | null {
  const parts = [t.location_city, t.location_region, t.location_country].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length) return parts.join(", ");
  return t.location_text?.trim() || null;
}
