import type { Metadata } from "next";
import EditEntry from "@/components/EditEntry";

export const metadata: Metadata = { title: "Edit testimony" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">Edit</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50">Revise your testimony</h1>
      <div className="mt-10">
        <EditEntry id={id} />
      </div>
    </main>
  );
}
