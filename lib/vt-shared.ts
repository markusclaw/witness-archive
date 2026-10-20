/** Versión Testigo types and labels that client components can import. */

export type VtStatus = "draft" | "reviewed" | "approved";

export interface VtNote {
  type: string;
  text: string;
}

export interface VtVerse {
  chapter: number;
  verse: number;
  text: string;
  notes: VtNote[];
  status: VtStatus;
  revision_id: string | null;
  updated_at: string;
  /** Word map back to the original (see migration 028). */
  alignment?: VtAlignment | null;
}

/** Which word(s) of the original each phrase of the verse renders. */
export interface VtAlignment {
  /** The verse text the map was made for; ignored if the text has changed. */
  text: string;
  /** i = first word token, n = number of tokens, h = original word positions. */
  map: { w: string; h: number[]; i: number; n: number }[];
}

export interface VtRevision {
  id: string;
  chapter: number;
  verse: number;
  text: string;
  kind: "ai_draft" | "edit" | "review" | "approval";
  author: string;
  comment: string | null;
  created_at: string;
}

export interface VtCheck {
  revision_id: string;
  chapter: number;
  verse: number;
  kind: string;
  severity: "info" | "warn" | "error";
  message: string;
  resolved: boolean;
}

export const STATUS_LABEL: Record<VtStatus, string> = { draft: "Borrador", reviewed: "Revisado", approved: "Aprobado" };
export const KIND_LABEL: Record<VtRevision["kind"], string> = { ai_draft: "Borrador de IA", edit: "Corrección", review: "Revisión", approval: "Aprobación" };
export const NOTE_LABEL: Record<string, string> = { alternativa: "Alternativa", texto: "Texto", significado: "Significado", medida: "Medida" };
