"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAllNotes, type VerseNote } from "@/lib/notes";
import { BOOKS, bookSlug } from "@/lib/scripture";
import { readerLanguage } from "@/lib/reader-language";

/** Every note the reader has written, newest first, with a filter box. Each opens its passage. */
export default function MyNotes() {
  const [state, setState] = useState<{ notes: VerseNote[]; signedIn: boolean } | null>(null);
  const [lang, setLang] = useState("en");
  const [filter, setFilter] = useState("");
  const ui = UI[lang] ?? UI.en;

  useEffect(() => {
    queueMicrotask(() => setLang(readerLanguage()));
    loadAllNotes().then(setState);
  }, []);

  const label = (n: VerseNote) => {
    const b = BOOKS[n.book];
    return `${b.names[lang] ?? b.names.en} ${n.chapter}:${n.verse_start}${n.verse_end !== n.verse_start ? `–${n.verse_end}` : ""}`;
  };
  const href = (n: VerseNote) => `/bible/${bookSlug(n.book)}/${n.chapter}?v=${n.verse_start}${n.verse_end !== n.verse_start ? `-${n.verse_end}` : ""}${lang !== "en" ? `&lang=${lang}` : ""}`;

  const shown = useMemo(() => {
    const t = filter.trim().toLowerCase();
    if (!state) return [];
    if (!t) return state.notes;
    return state.notes.filter((n) => n.body.toLowerCase().includes(t) || label(n).toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, filter, lang]);

  return (
    <>
      <p className="text-xs text-parchment-500">
        <Link href="/bible" className="hover:text-gold-300">{ui.bible}</Link>
      </p>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">{ui.title}</h1>
      {state && !state.signedIn && (
        <p className="mt-4 rounded-xl border border-ink-600 bg-ink-900/60 px-4 py-3 text-sm text-parchment-400">
          {ui.local} <Link href="/auth?next=/bible/notes" className="text-gold-300 underline-offset-2 hover:underline">{ui.signIn}</Link>
        </p>
      )}
      {state && state.notes.length > 3 && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={ui.filter} className="input mt-6 w-full" />
      )}
      {state === null && <p className="mt-8 text-sm text-parchment-500">{ui.loading}</p>}
      {state && state.notes.length === 0 && (
        <p className="mt-8 text-parchment-400">{ui.empty}</p>
      )}
      <ul className="mt-8 space-y-4">
        {shown.map((n) => (
          <li key={n.id}>
            <Link href={href(n)} className="card block p-5 transition hover:border-gold-500/50">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-lg text-parchment-50">{label(n)}</span>
                <span className="text-xs text-parchment-600">{new Date(n.updated_at).toLocaleDateString(lang)}</span>
              </span>
              <span className="mt-2 block whitespace-pre-wrap text-parchment-300" dir="auto">{n.body.length > 400 ? n.body.slice(0, 400) + "…" : n.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

const UI: Record<string, { bible: string; title: string; local: string; signIn: string; filter: string; loading: string; empty: string }> = {
  en: { bible: "The Bible", title: "My notes", local: "These notes are saved in this browser only.", signIn: "Sign in to keep them on every device →", filter: "Search your notes…", loading: "Loading…", empty: "No notes yet. In any chapter, tap a verse and choose Note." },
  es: { bible: "La Biblia", title: "Mis notas", local: "Estas notas se guardan solo en este navegador.", signIn: "Inicia sesión para tenerlas en todos tus dispositivos →", filter: "Buscar en tus notas…", loading: "Cargando…", empty: "Aún no hay notas. En cualquier capítulo, toca un versículo y elige Nota." },
  pt: { bible: "A Bíblia", title: "Minhas notas", local: "Estas notas ficam salvas só neste navegador.", signIn: "Entre na conta para tê-las em todos os dispositivos →", filter: "Buscar nas suas notas…", loading: "Carregando…", empty: "Ainda não há notas. Em qualquer capítulo, toque num versículo e escolha Nota." },
};
