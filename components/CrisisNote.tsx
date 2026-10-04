/**
 * Shown when a post suggests the writer may be in danger. Warm, short, and
 * concrete; the post itself is held so a person on the team sees it.
 */
export default function CrisisNote() {
  return (
    <div className="rounded-lg border border-gold-500/40 bg-gold-500/5 p-5 text-parchment-100">
      <p className="font-display text-xl text-parchment-50">We read what you wrote, and we&apos;re glad you did.</p>
      <p className="mt-3 text-parchment-300">
        Someone on the team will see your request personally. If you are thinking about ending your life or hurting yourself, please don&apos;t wait on us — reach a person right now:
      </p>
      <ul className="mt-3 space-y-1 text-sm text-parchment-100">
        <li>United States: call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline), any hour.</li>
        <li>Elsewhere: <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="text-gold-400 underline hover:text-gold-300">findahelpline.com</a> lists free lines by country.</li>
        <li>If you are in immediate danger, call your local emergency number.</li>
      </ul>
      <p className="mt-3 text-sm text-parchment-500">You are not a burden, and you are not alone in this.</p>
    </div>
  );
}
