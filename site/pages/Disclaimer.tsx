// INHERITFI: disclaimer:
// 12 sections. The fee cap of section 3 comes
// from MAX_TAX (site/params.ts).

import { st, type SiteKey } from "../i18n";
import { formatFee, MAX_TAX_BPS } from "../params";

/** Date of the last change of the text (changed by hand together with the text). */
export const DISCLAIMER_UPDATED = "2026-10-16";

/** "2026-10-16" → "October 16, 2026" (in English, without depending on the time zone of whoever builds). */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

type Part = { readonly p: SiteKey } | { readonly list: readonly SiteKey[] };

const SECTIONS: readonly { readonly title: SiteKey; readonly body: readonly Part[] }[] = [
  { title: "disclaimer.s1Title", body: [{ p: "disclaimer.s1p1" }] },
  { title: "disclaimer.s2Title", body: [{ p: "disclaimer.s2p1" }] },
  { title: "disclaimer.s3Title", body: [{ p: "disclaimer.s3p1" }, { p: "disclaimer.s3p2" }, { p: "disclaimer.s3p3" }] },
  { title: "disclaimer.s4Title", body: [{ p: "disclaimer.s4p1" }, { list: ["disclaimer.s4i1", "disclaimer.s4i2", "disclaimer.s4i3"] }] },
  { title: "disclaimer.s5Title", body: [{ p: "disclaimer.s5p1" }] },
  { title: "disclaimer.s6Title", body: [{ p: "disclaimer.s6p1" }] },
  { title: "disclaimer.s7Title", body: [{ p: "disclaimer.s7p1" }] },
  { title: "disclaimer.s8Title", body: [{ list: ["disclaimer.s8i1", "disclaimer.s8i2", "disclaimer.s8i3", "disclaimer.s8i4"] }] },
  { title: "disclaimer.s9Title", body: [{ p: "disclaimer.s9p1" }] },
  { title: "disclaimer.s10Title", body: [{ list: ["disclaimer.s10i1", "disclaimer.s10i2"] }] },
  { title: "disclaimer.s11Title", body: [{ p: "disclaimer.s11p1" }] },
  { title: "disclaimer.s12Title", body: [{ p: "disclaimer.s12p1" }] },
];

/** Text of a paragraph; the one of section 3 carries the fee cap. */
const text = (k: SiteKey) => (k === "disclaimer.s3p2" ? st(k, { max: formatFee(MAX_TAX_BPS) }) : st(k));

export function Disclaimer() {
  return (
    <div className="legal">
      <div className="legal__head reveal">
        <h1>
          {st("disclaimer.headingStart")}
          <span className="shimmer">{st("disclaimer.headingEnd")}</span>
        </h1>
        <p className="legal__meta">{st("disclaimer.meta", { date: longDate(DISCLAIMER_UPDATED) })}</p>
        <p className="legal__lead">{st("disclaimer.lead")}</p>
        <nav className="legal__toc" aria-label={st("disclaimer.sections")}>
          {SECTIONS.map((s, i) => (
            <a key={s.title} href={`#s${String(i + 1)}`}>
              {`${String(i + 1)}. ${st(s.title)}`}
            </a>
          ))}
        </nav>
      </div>
      {SECTIONS.map((s, i) => (
        <section key={s.title} className="card clause" id={`s${String(i + 1)}`}>
          <div className="clause__n">{String(i + 1).padStart(2, "0")}</div>
          <h2>{st(s.title)}</h2>
          <div className="clause__body">
            {s.body.map((part) =>
              "p" in part ? (
                <p key={part.p}>{text(part.p)}</p>
              ) : (
                <ul key={part.list[0]}>
                  {part.list.map((k) => (
                    <li key={k}>{text(k)}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
