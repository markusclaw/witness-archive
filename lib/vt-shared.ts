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
