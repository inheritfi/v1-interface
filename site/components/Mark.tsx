// INHERITFI: site mark, as in the header of the landing: the official base and icon, and the logo
// text, from the symbol sheet (Sprite.tsx), which uses the same pieces as the app (src/components/Brand.tsx).

export function Mark({ className }: { className: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href="#brand-base" />
      <use href="#brand-icon" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <svg className="word" role="img" aria-label="INHERITFI">
      <use href="#brand-word" />
    </svg>
  );
}
