import type { Metadata } from "next";
import ImportsDashboard from "@/components/ImportsDashboard";

export const metadata: Metadata = { title: "Imports", robots: { index: false, follow: false } };

export default function ImportsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow mb-3">Team</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50">YouTube imports</h1>
      <p className="mt-3 text-parchment-500">Videos imported through the API. Anything the assistant wasn&rsquo;t sure about is published with that field left blank and listed under Needs review.</p>
      <div className="mt-10">
        <ImportsDashboard />
      </div>
    </main>
  );
}
