import type { Metadata } from "next";
import SettingsForm from "@/components/SettingsForm";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="eyebrow mb-3">Your account</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50">Settings</h1>
      <p className="mt-3 text-parchment-500">How you appear on testimonies and in conversations.</p>
      <div className="mt-10">
        <SettingsForm />
      </div>
    </main>
  );
}
