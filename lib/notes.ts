"use client";

import { supabase } from "@/lib/supabase";

/**
 * A reader's private notes on a verse or passage. Members' notes live in
 * `bible_notes` and follow them across devices; a visitor's live in this
 * browser under `wa:notes` and are moved to the account on first sign-in.
 */

export interface VerseNote {
  id: string;
  book: number;
  chapter: number;
  verse_start: number;
  verse_end: number;
  body: string;
  updated_at: string;
}

const LOCAL_KEY = "wa:notes";

function readLocal(): VerseNote[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(v) ? (v as VerseNote[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(notes: VerseNote[]) {
  try {
    if (notes.length) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
    else window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Move this browser's notes into the account (once, right after sign-in). */
async function adoptLocal(uid: string) {
  const local = readLocal();
  if (!local.length) return;
  const rows = local.map(({ book, chapter, verse_start, verse_end, body }) => ({ user_id: uid, book, chapter, verse_start, verse_end, body }));
  const { error } = await supabase.from("bible_notes").insert(rows);
  if (!error) writeLocal([]);
}

const COLS = "id, book, chapter, verse_start, verse_end, body, updated_at";

export async function loadChapterNotes(book: number, chapter: number): Promise<VerseNote[]> {
  const uid = await userId();
  if (!uid) return readLocal().filter((n) => n.book === book && n.chapter === chapter);
  await adoptLocal(uid);
  const { data } = await supabase.from("bible_notes").select(COLS).eq("user_id", uid).eq("book", book).eq("chapter", chapter).order("verse_start");
  return (data ?? []) as VerseNote[];
}

export async function loadAllNotes(): Promise<{ notes: VerseNote[]; signedIn: boolean }> {
  const uid = await userId();
  if (!uid) return { notes: readLocal().sort((a, b) => b.updated_at.localeCompare(a.updated_at)), signedIn: false };
  await adoptLocal(uid);
  const { data } = await supabase.from("bible_notes").select(COLS).eq("user_id", uid).order("updated_at", { ascending: false }).limit(500);
  return { notes: (data ?? []) as VerseNote[], signedIn: true };
}

/** Create or update a note. Returns the saved note. */
export async function saveNote(note: Omit<VerseNote, "id" | "updated_at"> & { id?: string }): Promise<VerseNote | null> {
  const body = note.body.trim();
  if (!body) return null;
  const uid = await userId();
  const now = new Date().toISOString();
  if (!uid) {
    const all = readLocal();
    const id = note.id ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const saved: VerseNote = { id, book: note.book, chapter: note.chapter, verse_start: note.verse_start, verse_end: note.verse_end, body, updated_at: now };
    writeLocal([...all.filter((n) => n.id !== id), saved]);
    return saved;
  }
  const row = { user_id: uid, book: note.book, chapter: note.chapter, verse_start: note.verse_start, verse_end: note.verse_end, body };
  const q = note.id && !note.id.startsWith("local-")
    ? supabase.from("bible_notes").update({ body }).eq("id", note.id).eq("user_id", uid)
    : supabase.from("bible_notes").insert(row);
  const { data, error } = await q.select(COLS).single();
  if (error) {
    console.error("saveNote:", error.message);
    return null;
  }
  return data as VerseNote;
}

export async function deleteNote(id: string): Promise<void> {
  if (id.startsWith("local-")) {
    writeLocal(readLocal().filter((n) => n.id !== id));
    return;
  }
  const uid = await userId();
  if (uid) await supabase.from("bible_notes").delete().eq("id", id).eq("user_id", uid);
}
