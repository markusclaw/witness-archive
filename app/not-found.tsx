import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="font-display text-4xl text-parchment-50">This page isn&apos;t in the archive.</h1>
      <p className="mt-4 text-parchment-500">The link may be old, or the testimony may have been removed at its creator&apos;s request.</p>
      <Link href="/archive" className="btn btn-primary mt-8">
        Browse the archive
      </Link>
    </main>
  );
}
