import type { Metadata } from "next";
import EditionHome from "@/components/edition/EditionHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rut — Versión Testigo",
  description: "El libro de Rut en la Versión Testigo, la edición en español de la Open Bible Translation, traducida desde el hebreo.",
  // In progress: shared by link, not listed in search engines yet.
  robots: { index: false, follow: false },
};

export default function VtHomePage() {
  return <EditionHome edition="vt" />;
}
