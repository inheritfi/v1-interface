// INHERITFI: landing (inheritfi.com). The protocol
// figures come from verified data: assets of the environment manifest, the fee cap MAX_TAX and the
// maximum of heirs from site/params.ts.

import { deployment } from "@deployment";
import { st } from "../i18n";
import { Mark } from "../components/Mark";
import { Use } from "../components/Sprite";
import { DOCS_PATH, EXTERNAL } from "./Layout";
import { socialOf, type SiteConfig } from "../config";
import { formatFee, MAX_TAX_BPS, type ProtocolParams } from "../params";
import { MARKET } from "../stats";

/** Order of the ribbon: ETH first and then by name, case-insensitive (that of the authorized landing). */
export function tickerOrder(tickers: readonly string[]): string[] {
  const rest = tickers.filter((t) => t !== "ETH").sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), "en"));
  return tickers.includes("ETH") ? ["ETH", ...rest] : rest;
}

interface Stat {
  readonly value: string;
  readonly count: string;
  readonly pre?: string;
  readonly suf?: string;
  readonly dec?: string;
  readonly label: string;
}

export function Home({ config, params }: { config: SiteConfig; params: ProtocolParams }) {
  const social = socialOf(config);
  const count = deployment.assets.length;
  const erc20 = deployment.assets.filter((a) => a.underlying.kind === "erc20").length;
  const max = formatFee(MAX_TAX_BPS);
  const tickers = tickerOrder(deployment.assets.map((a) => a.ticker));
  const stats: readonly Stat[] = [
    { value: `$${MARKET.marketCapTrillions}T`, count: MARKET.marketCapTrillions, pre: "$", suf: "T", dec: "3", label: st("stats.marketCap") },
    { value: `${MARKET.usersMillions}M+`, count: MARKET.usersMillions, suf: "M+", label: st("stats.users") },
    // The animation ends with the same decimals as the text (formatFee: "0.3%" → 1 decimal).
    { value: `≤${max}`, count: max.slice(0, -1), pre: "≤", suf: "%", dec: String(max.slice(0, -1).split(".")[1]?.length ?? 0), label: st("stats.fee") },
    { value: String(count), count: String(count), label: st("stats.assets") },
    { value: "100%", count: "100", suf: "%", label: st("stats.onChain") },
  ];
  const steps = [
    { title: st("how.wrapTitle"), body: st("how.wrapBody", { count }) },
    { title: st("how.configureTitle"), body: st("how.configureBody") },
    { title: st("how.liveTitle"), body: st("how.liveBody") },
    { title: st("how.inheritTitle"), body: st("how.inheritBody") },
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="orb reveal" aria-hidden="true">
            <div className="orb__halo" />
            <div className="orb__ring orb__ring--3" />
            <div className="orb__ring orb__ring--2" />
            <div className="orb__ring orb__ring--1" />
            <div className="orb__dot" />
            <div className="orb__core">
              <Mark className="orb__mark" />
            </div>
          </div>
          <div className="reveal d-10">
            <span className="live">
              <span className="live__dot" />
              {st("hero.live")}
            </span>
          </div>
          <h1 className="hero__title reveal d-20">
            {st("hero.titleStart")}
            <br />
            <span className="shimmer">{st("hero.titleEnd")}</span>
          </h1>
          <p className="hero__lead reveal d-30">{st("hero.lead", { count })}</p>
          <div className="hero__ctas reveal d-40">
            <a className="btn btn--primary" href={config.appUrl}>
              {st("hero.launch")}
            </a>
            <a className="btn btn--glass" href={DOCS_PATH}>
              {st("hero.docs")}
            </a>
            <a className="btn btn--ghost" href={social.github} {...EXTERNAL}>
              <Use name="github" size={18} />
              {st("hero.github")}
              <Use name="out" size={14} />
            </a>
          </div>
          <div className="stats reveal d-50">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="stat__v" data-count={s.count} data-pre={s.pre} data-suf={s.suf} data-dec={s.dec}>
                  {s.value}
                </div>
                <div className="stat__l">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="marquee reveal d-60" aria-label={st("assets.label")}>
          <div className="marquee__track">
            {[0, 1].flatMap((copy) =>
              tickers.map((t) => (
                <span key={`${String(copy)}-${t}`} className={t === "ETH" ? "chip chip--eth" : "chip"} aria-hidden={copy === 1 ? "true" : undefined}>
                  <i />
                  {t}
                </span>
              )),
            )}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="head reveal">
            <h2>
              {st("features.titleStart")} <span className="shimmer">{st("features.titleEnd")}</span>
            </h2>
            <p>{st("features.sub")}</p>
          </div>
          <div className="bento">
            <article className="card bento__big reveal">
              <div className="bento__glyph">
                <Mark className="bento__mark" />
              </div>
              <h3>
                {st("features.onChainStart")}
                <br />
                <span className="shimmer">{st("features.onChainEnd")}</span>
              </h3>
              <p>{st("features.onChainBody")}</p>
              <div className="tags">
                <span>{st("features.tagCustody")}</span>
                <span>{st("features.tagSource")}</span>
              </div>
            </article>
            <article className="card mini mini--heirs reveal d-08">
              <div className="mini__icon">
                <Use name="heirs" />
              </div>
              <h3>{st("features.heirsTitle")}</h3>
              <p>{st("features.heirsBody", { max: params.maxHeirs })}</p>
            </article>
            <article className="card mini mini--rec reveal d-16">
              <div className="mini__icon">
                <Use name="shield-check" />
              </div>
              <h3>{st("features.recoveryTitle")}</h3>
              <p>{st("features.recoveryBody")}</p>
            </article>
            <article className="card mini mini--fee reveal d-24">
              <div className="mini__icon">
                <Use name="fee" />
              </div>
              <h3>{st("features.feesTitle")}</h3>
              <p>{st("features.feesBody", { max })}</p>
            </article>
            <article className="card mini mini--assets reveal d-32">
              <div className="mini__icon">
                <Use name="layers" />
              </div>
              <h3>{st("features.assetsTitle", { count })}</h3>
              <p>{st("features.assetsBody", { erc20 })}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="head reveal">
            <h2>
              {st("how.titleStart")} <span className="shimmer">{st("how.titleEnd")}</span>
            </h2>
            <p>{st("how.sub")}</p>
          </div>
          <div className="steps" id="steps">
            <div className="steps__rail" aria-hidden="true">
              <i />
            </div>
            {steps.map((s, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <article key={n} className={i === 0 ? "card step reveal" : `card step reveal d-${String(i * 10)}`}>
                  <span className="step__big" aria-hidden="true">
                    {n}
                  </span>
                  <div className="step__n">{n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="cta reveal">
          <span className="cta__eyebrow">{st("cta.eyebrow")}</span>
          <h2>
            {st("cta.titleStart")}
            <br />
            <span className="shimmer">{st("cta.titleEnd")}</span>
          </h2>
          <p>{st("cta.body")}</p>
          <a className="btn btn--primary" href={config.appUrl}>
            {st("cta.launch")}
            <Use name="arrow" size={18} />
          </a>
        </div>
      </section>
    </>
  );
}
