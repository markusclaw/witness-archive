import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TestimonyArticle, { testimonyMetadata } from "@/components/TestimonyArticle";
import { isSupportedLanguage } from "@/lib/languages";

export const dynamic = "force-dynamic";

type Params = Promise<{ lang: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isSupportedLanguage(lang)) return { title: "Not found", robots: { index: false } };
  return testimonyMetadata(id, lang.toLowerCase());
}

/** /es/testimony/<slug>-<uuid> — the testimony translated into that language. */
export default async function LocalizedTestimonyPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  return <TestimonyArticle param={id} lang={lang.toLowerCase()} prefixed />;
}
