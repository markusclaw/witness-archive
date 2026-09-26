import type { Metadata } from "next";
import EditEntry from "@/components/EditEntry";

export const metadata: Metadata = { title: "Edit testimony" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="writing-chrome mb-8">
        <p className="eyebrow mb-2">Edit</p>
        <p className="text-parchment-500">Changes go live when you press Update.</p>
      </div>
      <EditEntry id={id} />
    </main>
  );
}
