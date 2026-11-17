// INHERITFI: official logo (icon and text v2.0.2), the same as in the header of the landing: opaque hexagonal base
// (#0a0b10) under the icon, without glow. The pieces (gradients, base, icon and text) are exported separately so
// that the site uses them as SVG symbols: the app and the site draw exactly the same shapes. The identifiers
// of the gradients carry the prefix "bi-"/"bw-" and each document defines them only once.

/** Gradients of the icon (inside a <defs>). */
export function BrandGradients() {
  return (
    <>
      <linearGradient id="bi-cryptoViolet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7F00FF" />
        <stop offset="100%" stopColor="#FF007F" />
      </linearGradient>
      <linearGradient id="bi-blockchainCyan" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#00F2FE" />
        <stop offset="100%" stopColor="#4FACFE" />
      </linearGradient>
      <linearGradient id="bi-darkShield" x1="-167.57088" y1="-167.57088" x2="-167.57088" y2="167.57088" gradientTransform="scale(0.93094934,1.0741723)" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#232526" />
        <stop offset="100%" stopColor="#414345" />
      </linearGradient>
      <linearGradient href="#bi-blockchainCyan" id="bi-linearGradient1" x1="-150.74365" y1="150.74365" x2="150.74365" y2="-150.74365" gradientTransform="scale(0.92872902,1.0767403)" gradientUnits="userSpaceOnUse" />
      <linearGradient href="#bi-cryptoViolet" id="bi-linearGradient2" x1="-113.32563" y1="-113.32563" x2="113.32563" y2="113.32563" gradientTransform="scale(0.93094566,1.0741766)" gradientUnits="userSpaceOnUse" />
      <linearGradient href="#bi-blockchainCyan" id="bi-linearGradient3" x1="-57.445625" y1="-15.666989" x2="57.445625" y2="-130.55824" gradientTransform="scale(1.0444659,0.95742711)" gradientUnits="userSpaceOnUse" />
      <linearGradient href="#bi-cryptoViolet" id="bi-linearGradient4" x1="-47.434166" y1="-37.94733" x2="47.434166" y2="56.920998" gradientTransform="scale(1.2649111,0.79056942)" gradientUnits="userSpaceOnUse" />
      <linearGradient href="#bi-blockchainCyan" id="bi-linearGradient5" x1="-47.434166" y1="132.81566" x2="47.434166" y2="37.94733" gradientTransform="scale(1.2649111,0.79056942)" gradientUnits="userSpaceOnUse" />
    </>
  );
}

/** Opaque hexagonal base, in the 312 x 360 system of the icon. */
export function BrandBase() {
  return <polygon transform="translate(156,180)" points="0,180 -156,90 -156,-90 0,-180 156,-90 156,90" fill="#0a0b10" />;
}

/** Shapes of the official icon, in the 312 x 360 system. */
export function BrandIconBody() {
  return (
    <g transform="translate(156,180)">
      <polygon points="0,180 -156,90 -156,-90 0,-180 156,-90 156,90 " fill="url(#bi-darkShield)" opacity="0.5" />
      <polygon points="0,160 -138,80 -138,-80 0,-160 138,-80 138,80 " fill="none" stroke="url(#bi-linearGradient1)" strokeWidth="4" opacity="0.3" />
      <polygon points="0,120 -104,60 -104,-60 0,-120 104,-60 104,60 " fill="none" stroke="url(#bi-linearGradient2)" strokeWidth="3" opacity="0.4" />
      <path d="m -60,-90 60,-35 60,35 v 40 L 0,-15 -60,-50 Z" fill="url(#bi-linearGradient3)" />
      <path d="M -60,-30 0,5 60,-30 V 10 L 0,45 -60,10 Z" fill="url(#bi-linearGradient4)" />
      <path d="M -60,30 0,65 60,30 V 70 L 0,105 -60,70 Z" fill="url(#bi-linearGradient5)" />
      <line x1="0" y1="-125" x2="0" y2="105" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeDasharray="1, 15" opacity="0.7" />
      <circle cx="0" cy="-125" r="8" fill="#00f2fe" />
      <circle cx="0" cy="105" r="8" fill="#ff007f" />
    </g>
  );
}

/** Gradient of the logo text (inside a <defs>). */
export function BrandWordGradient() {
  return (
    <linearGradient id="bw-blockchainCyan" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#00F2FE" />
      <stop offset="100%" stopColor="#4FACFE" />
    </linearGradient>
  );
}

/** Text of the logo, in the 433.02417 x 52.543945 system. */
export function BrandWordText() {
  return (
    <text x="215.55212" y="52.543945" fontFamily="Montserrat, 'Helvetica Neue', sans-serif" fontWeight="900" fontSize="64px" fill="#ffffff" letterSpacing="12" textAnchor="middle">
      INHERIT<tspan fill="url(#bw-blockchainCyan)">Fi</tspan>
    </text>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 312 360" aria-hidden="true">
      <defs>
        <BrandGradients />
      </defs>
      <BrandBase />
      <BrandIconBody />
    </svg>
  );
}

export function BrandWord({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 433.02417 52.543945" role="img" aria-label="INHERITFI">
      <defs>
        <BrandWordGradient />
      </defs>
      <BrandWordText />
    </svg>
  );
}
