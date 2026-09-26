/** A small candle flame inside a ring — the archive's mark. */
export default function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path
        d="M16 7c2.8 3.4 5 6.2 5 9.6A5 5 0 0 1 11 16.6C11 13.2 13.2 10.4 16 7Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M16 13.5c1.2 1.5 2 2.7 2 4a2 2 0 1 1-4 0c0-1.3.8-2.5 2-4Z" fill="#0a0908" opacity="0.7" />
      <path d="M12 25.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
