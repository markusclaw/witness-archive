"use client";

import { useEffect, useRef, useState } from "react";
import { deleteNote, saveNote, type VerseNote } from "@/lib/notes";

/**
 * Write or edit a private note on a verse or passage. Slides up from the
 * bottom like the word card; the passage text sits above the box so you can
 * see what you're writing about.
 */
export default function NoteSheet({
  reference,
  quote,
  existing,
  anchor,
  lang,
  onSaved,
  onDeleted,
  onClose,
}: {
  reference: string;
  quote: string;
  existing: VerseNote | null;
  anchor: { book: number; chapter: number; verse_start: number; verse_end: number };
  lang: string;
  onSaved: (n: VerseNote) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const ui = UI[lang] ?? UI.en;

  useEffect(() => {
    setTimeout(() => box.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(false);
    const saved = await saveNote({ ...anchor, id: existing?.id, body });
    setBusy(false);
    if (!saved) {
      setError(true);
      return;
    }
    onSaved(saved);
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    await deleteNote(existing.id);
    setBusy(false);
    onDeleted(existing.id);
  };

  return (
    <div className="wa-sheet fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${ui.note}: ${reference}`}>
      <button type="button" aria-label={ui.cancel} onClick={onClose} className="absolute inset-0 bg-ink-950/60" />
      <div className="relative w-full max-w-xl rounded-t-2xl border border-ink-500 bg-ink-900 p-5 shadow-2xl shadow-black/60 sm:rounded-2xl">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl text-parchment-50" lang={lang}>{reference}</p>
          <p className="eyebrow">{existing ? ui.editNote : ui.newNote}</p>
        </div>
        <p className="mt-2 line-clamp-3 border-l-2 border-gold-500/50 pl-3 text-sm italic text-parchment-400" lang={lang}>{quote}</p>
        <textarea
          ref={box}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save();
            }
          }}
          rows={6}
          maxLength={10000}
          placeholder={ui.placeholder}
          className="input mt-4 min-h-[9rem] w-full resize-y text-base leading-relaxed"
          dir="auto"
        />
        {error && <p className="mt-2 text-sm text-ember-500">{ui.error}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            {existing && (
              <button type="button" onClick={remove} disabled={busy} className="text-sm text-parchment-500 underline-offset-2 hover:text-ember-500 hover:underline">
                {ui.delete}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost !h-9 !px-4 !text-sm">{ui.cancel}</button>
            <button type="button" onClick={save} disabled={busy || !body.trim()} className="btn btn-primary !h-9 !px-5 !text-sm">
              {busy ? ui.saving : ui.save}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[0.7rem] text-parchment-700">{ui.privacy}</p>
      </div>
    </div>
  );
}

const UI: Record<string, { note: string; newNote: string; editNote: string; placeholder: string; save: string; saving: string; cancel: string; delete: string; error: string; privacy: string }> = {
  en: { note: "Note", newNote: "New note", editNote: "Your note", placeholder: "What stood out to you? A thought, a question, a prayer…", save: "Save note", saving: "Saving…", cancel: "Cancel", delete: "Delete note", error: "Couldn't save just now — try again.", privacy: "Only you can see your notes. Sign in and they follow you to any device." },
  es: { note: "Nota", newNote: "Nueva nota", editNote: "Tu nota", placeholder: "¿Qué te llamó la atención? Un pensamiento, una pregunta, una oración…", save: "Guardar nota", saving: "Guardando…", cancel: "Cancelar", delete: "Eliminar nota", error: "No se pudo guardar — inténtalo de nuevo.", privacy: "Solo tú puedes ver tus notas. Inicia sesión y te siguen a cualquier dispositivo." },
  pt: { note: "Nota", newNote: "Nova nota", editNote: "Sua nota", placeholder: "O que chamou sua atenção? Um pensamento, uma pergunta, uma oração…", save: "Salvar nota", saving: "Salvando…", cancel: "Cancelar", delete: "Excluir nota", error: "Não foi possível salvar — tente de novo.", privacy: "Só você vê suas notas. Entre na conta e elas acompanham você em qualquer dispositivo." },
};
