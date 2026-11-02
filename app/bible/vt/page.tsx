import type { Metadata } from "next";
import EditionHome from "@/components/edition/EditionHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Versión Testigo",
  description: "La edición en español de la Open Bible Translation, traducida directamente del hebreo y el griego — borrador en desarrollo.",
  // In progress: shared by link, not listed in search engines yet.
  robots: { index: false, follow: false },
};

export default function VtHomePage() {
  return <EditionHome edition="vt" />;
}
