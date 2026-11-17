// INHERITFI: dropdown menu of the landing, in the app: App, Docs, Disclaimer and official links.
// It closes when clicking outside, with Escape (focus returns to the button), when choosing an option and when leaving the page. "App" only closes the menu (you
// are already in the app). Docs points to /docs/ of the site (it will give 404 until the documentation is built). Docs, Disclaimer and
// the networks open in another tab so as not to lose the screen or a transaction in progress.

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { t } from "../i18n";
import type { AppLinks } from "../lib/links";
import { Icon } from "./Icon";

const Arrow = () => <Icon name="arrow" className="menu__arrow" size={18} />;

export function AppMenu({ links }: { links: AppLinks }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (box.current !== null && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When going back with "back" or "forward", the browser may restore the page as it was left (back-forward cache),
  // with the menu open: it is closed when leaving the page (synchronously, before the browser saves it) and again
  // if the page comes back from that cache. The same as in the site (site/client/main.ts).
  useEffect(() => {
    const onHide = () => {
      flushSync(() => {
        setOpen(false);
      });
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setOpen(false);
    };
    addEventListener("pagehide", onHide);
    addEventListener("pageshow", onShow);
    return () => {
      removeEventListener("pagehide", onHide);
      removeEventListener("pageshow", onShow);
    };
  }, []);

  const close = () => {
    setOpen(false);
  };
  const out = { target: "_blank", rel: "noopener noreferrer", onClick: close } as const;

  return (
    <div className="app__menu" ref={box}>
      <button
        ref={btn}
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("menu.button")}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className={open ? "menu is-open" : "menu"} id={id} aria-label={t("menu.button")} inert={!open}>
        <div className="menu__label">{t("menu.protocol")}</div>
        <button ref={first} type="button" className="menu__item menu__item--app" aria-current="page" onClick={close}>
          <span className="menu__icon"><Icon name="app" /></span>
          <span className="menu__text">
            <span className="menu__title">{t("menu.app")}</span>
            <span className="menu__desc">{t("menu.appDesc")}</span>
          </span>
          <Arrow />
        </button>
        <a className="menu__item" href={`${links.site}/docs/`} {...out}>
          <span className="menu__icon"><Icon name="docs" /></span>
          <span className="menu__text">
            <span className="menu__title">{t("menu.docs")}</span>
            <span className="menu__desc">{t("menu.docsDesc")}</span>
          </span>
          <Arrow />
        </a>
        <a className="menu__item" href={`${links.site}/disclaimer/`} {...out}>
          <span className="menu__icon"><Icon name="doc-alert" /></span>
          <span className="menu__text">
            <span className="menu__title">{t("menu.disclaimer")}</span>
            <span className="menu__desc">{t("menu.disclaimerDesc")}</span>
          </span>
          <Arrow />
        </a>
        <div className="menu__sep" />
        <div className="menu__label">{t("menu.social")}</div>
        <div className="menu__social">
          <a href={links.x} {...out}><Icon name="x" />X</a>
          <a href={links.discord} {...out}><Icon name="discord" />Discord</a>
          <a href={links.github} {...out}><Icon name="github" />GitHub</a>
        </div>
        <div className="menu__foot">{t("menu.trust")}</div>
      </nav>
    </div>
  );
}
