import type { Metadata } from "next";
import EditionBook, { bookMetadata } from "@/components/edition/EditionBook";

export const dynamic = "force-dynamic";

type Params = Promise<{ book: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return bookMetadata("vt", (await params).book);
}

export default async function Page({ params }: { params: Params }) {
  return <EditionBook edition="vt" slug={(await params).book} />;
}
