// INHERITFI: an icon of src/components/icons.ts as inline SVG (24 x 24, text color).

import { ICONS, type IconName } from "./icons";

export function IconPath({ name }: { name: IconName }) {
  const { d, stroke } = ICONS[name];
  return stroke === null ? (
    <path fill="currentColor" d={d} />
  ) : (
    <path fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" d={d} />
  );
}

export function Icon({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <IconPath name={name} />
    </svg>
  );
}
