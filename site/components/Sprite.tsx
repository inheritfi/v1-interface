// INHERITFI: SVG symbol sheet of the site, as in the authorized landing (308d557c…): base, icon and logo text
// (the same pieces as the app, src/components/Brand.tsx) and the icons (src/components/icons.ts). It goes once at the
// beginning of each page; the rest of the page uses them with <use href="#…">.

import { BrandBase, BrandGradients, BrandIconBody, BrandWordGradient, BrandWordText } from "../../src/components/Brand";
import { IconPath } from "../../src/components/Icon";
import { ICONS, type IconName } from "../../src/components/icons";

export function Sprite() {
  return (
    <svg className="sprite" aria-hidden="true">
      <defs>
        <BrandGradients />
        <BrandWordGradient />
        <symbol id="brand-icon" viewBox="0 0 312 360">
          <BrandIconBody />
        </symbol>
        <symbol id="brand-word" viewBox="0 0 433.02417 52.543945">
          <BrandWordText />
        </symbol>
        <symbol id="brand-base" viewBox="0 0 312 360">
          <BrandBase />
        </symbol>
        {(Object.keys(ICONS) as IconName[]).map((n) => (
          <symbol key={n} id={`i-${n}`} viewBox="0 0 24 24">
            <IconPath name={n} />
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/** An icon from the symbol sheet. */
export function Use({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
