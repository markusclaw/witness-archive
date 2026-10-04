"use client";

import { supabase } from "@/lib/supabase";

/**
 * Highlighter marks in the Bible reader. Members' marks live in
 * `bible_highlights` and follow them across devices; a visitor's live in
 * this browser under `wa:hl` and are moved to the account on first sign-in.
 */

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "violet"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type ChapterHighlights = Record<number, HighlightColor>;

const LOCAL_KEY = "wa:hl";
type LocalStore = Record<string, ChapterHighlights>; // "book.chapter" → { verse: color }

function readLocal(): LocalStore {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as LocalStore;
  } catch {
    return {};
  }
}

function writeLocal(store: LocalStore) {
  try {
    const compact = Object.fromEntries(Object.entries(store).filter(([, v]) => Object.keys(v).length));
    if (Object.keys(compact).length) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(compact));
    else window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Move this browser's marks into the account (once, right after sign-in). */
async function adoptLocal(uid: string) {
  const store = readLocal();
  const rows = Object.entries(store).flatMap(([key, verses]) => {
    const [book, chapter] = key.split(".").map(Number);
    return Object.entries(verses).map(([verse, color]) => ({ user_id: uid, book, chapter, verse: Number(verse), color }));
  });
  if (!rows.length) return;
  const { error } = await supabase.from("bible_highlights").upsert(rows, { onConflict: "user_id,book,chapter,verse" });
  if (!error) writeLocal({});
}

export async function loadHighlights(book: number, chapter: number): Promise<{ marks: ChapterHighlights; signedIn: boolean }> {
  const uid = await userId();
  if (!uid) return { marks: readLocal()[`${book}.${chapter}`] ?? {}, signedIn: false };
  await adoptLocal(uid);
  const { data } = await supabase.from("bible_highlights").select("verse, color").eq("user_id", uid).eq("book", book).eq("chapter", chapter);
  const marks: ChapterHighlights = {};
  for (const r of data ?? []) marks[r.verse] = r.color as HighlightColor;
  return { marks, signedIn: true };
}

/** Set (or with `color: null`, remove) the mark on some verses. */
export async function setHighlight(book: number, chapter: number, verses: number[], color: HighlightColor | null): Promise<void> {
  const uid = await userId();
  if (!uid) {
    const store = readLocal();
    const key = `${book}.${chapter}`;
    const cur = { ...(store[key] ?? {}) };
    for (const v of verses) {
      if (color) cur[v] = color;
      else delete cur[v];
    }
    store[key] = cur;
    writeLocal(store);
    return;
  }
  if (color) {
    await supabase.from("bible_highlights").upsert(verses.map((verse) => ({ user_id: uid, book, chapter, verse, color })), { onConflict: "user_id,book,chapter,verse" });
  } else {
    await supabase.from("bible_highlights").delete().eq("user_id", uid).eq("book", book).eq("chapter", chapter).in("verse", verses);
  }
}
