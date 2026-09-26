/**
 * The archive's fixed taxonomy. `name` is what's stored in
 * testimonies.category; `slug` is what appears in URLs.
 */
export interface Category {
  slug: string;
  name: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: "heaven",
    name: "Heaven",
    blurb: "Accounts of being taken beyond death and shown a place of light, peace, and presence.",
  },
  {
    slug: "hell",
    name: "Hell",
    blurb: "Sobering testimonies of darkness, separation, and the mercy that pulled people back.",
  },
  {
    slug: "near-death",
    name: "Near-Death Experience",
    blurb: "Clinical death, comas, and the moments in between — as remembered by those who returned.",
  },
  {
    slug: "divine-encounter",
    name: "Divine Encounter",
    blurb: "Face-to-face meetings with God, Jesus, or an overwhelming divine presence.",
  },
  {
    slug: "healing",
    name: "Healing",
    blurb: "Physical and emotional restoration that doctors could not explain.",
  },
  {
    slug: "angelic",
    name: "Angelic Encounter",
    blurb: "Messengers, protectors, and strangers who were never seen again.",
  },
  {
    slug: "visions",
    name: "Visions & Dreams",
    blurb: "Prophetic dreams, waking visions, and the events that later confirmed them.",
  },
  {
    slug: "deliverance",
    name: "Deliverance",
    blurb: "Freedom from oppression, addiction, and the things that once had a grip.",
  },
  {
    slug: "other",
    name: "Other",
    blurb: "Encounters that don't fit neatly anywhere else — but changed a life all the same.",
  },
];

export function categoryBySlug(slug: string | undefined | null): Category | undefined {
  if (!slug) return undefined;
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryByName(name: string | undefined | null): Category | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return CATEGORIES.find((c) => c.name.toLowerCase() === n);
}

export function slugForCategoryName(name: string): string {
  return categoryByName(name)?.slug ?? "other";
}
