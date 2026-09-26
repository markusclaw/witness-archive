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
