export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-24" aria-busy="true" aria-live="polite">
      <div className="h-3 w-24 animate-pulse rounded bg-ink-700" />
      <div className="mt-6 h-10 w-2/3 animate-pulse rounded bg-ink-700" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-video animate-pulse bg-ink-700" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-3/4 animate-pulse rounded bg-ink-700" />
              <div className="h-3 w-full animate-pulse rounded bg-ink-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
