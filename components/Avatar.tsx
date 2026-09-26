import { hueFor, initialsFor } from "@/lib/user";

const SIZES = { xs: "h-6 w-6 text-[0.6rem]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" } as const;

/** Uploaded image when there is one, otherwise warm initials on a stable per-person tint. */
export default function Avatar({
  name,
  src,
  seed,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  /** Something stable per person (user id) so the color doesn't change if they rename. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = `inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ring-1 ring-gold-500/30 ${SIZES[size]} ${className}`;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`${base} object-cover bg-ink-800`} />;
  }
  const hue = hueFor(seed ?? name);
  return (
    <span
      className={`${base} font-semibold tracking-wide`}
      style={{ background: `hsl(${hue} 28% 22%)`, color: `hsl(${hue} 45% 78%)` }}
      aria-label={name}
      role="img"
    >
      {initialsFor(name)}
    </span>
  );
}
