// INHERITFI: the only script of the site (CSP script-src 'self'), the one of the authorized landing: header on scroll,
// menu, light that follows the pointer, reveals, figure counting and the steps line; and the one of the documentation
// (site/client/docs.ts). No network or storage.
// The content is fully visible without JavaScript: the "js" class only enables the animations.
import "../styles/site.css";
import { initDocs } from "./docs";

document.documentElement.classList.add("js");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// header on scroll
const top = document.querySelector<HTMLElement>(".top");
if (top !== null) {
  const onScroll = () => {
    top.classList.toggle("is-scrolled", scrollY > 8);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// menu
const btn = document.querySelector<HTMLButtonElement>(".menu-btn");
const menu = document.getElementById("menu");
if (btn !== null && menu !== null) {
  const setMenu = (open: boolean) => {
    btn.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    if (open) menu.querySelector("a")?.focus({ preventScroll: true });
  };
  // When a menu link is chosen, the menu closes (as in the app); if it is the current page, it is not loaded again.
  menu.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a") : null;
    if (a === null) return;
    if (a.getAttribute("aria-current") === "page") e.preventDefault();
    setMenu(false);
  });
  // When going back with "back", the browser may restore the page as it was left (back-forward cache), with the menu
  // open: it is closed when leaving the page and again if the page comes back from that cache.
  addEventListener("pagehide", () => {
    setMenu(false);
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) setMenu(false);
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(btn.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Node) || !menu.contains(e.target)) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) {
      setMenu(false);
      btn.focus();
    }
  });
}

// light that follows the pointer (background and cards)
if (!reduce) {
  const bg = document.querySelector<HTMLElement>(".bg__spot");
  if (bg !== null) {
    addEventListener(
      "pointermove",
      (e) => {
        bg.style.setProperty("--mx", `${String(e.clientX)}px`);
        bg.style.setProperty("--my", `${String(e.clientY)}px`);
      },
      { passive: true },
    );
  }
  for (const c of document.querySelectorAll<HTMLElement>(".card")) {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--cx", `${String(e.clientX - r.left)}px`);
      c.style.setProperty("--cy", `${String(e.clientY - r.top)}px`);
    });
  }
}

// reveal on scroll and figure counting
const count = (el: HTMLElement) => {
  const end = parseFloat(el.dataset.count ?? "0");
  const dec = Number(el.dataset.dec ?? "0");
  const pre = el.dataset.pre ?? "";
  const suf = el.dataset.suf ?? "";
  if (reduce) return;
  const t0 = performance.now();
  const dur = 1400;
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const v = end * (1 - Math.pow(1 - k, 3));
    el.textContent = pre + v.toFixed(dec) + suf;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const io = new IntersectionObserver(
  (es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      for (const s of e.target.querySelectorAll<HTMLElement>("[data-count]")) count(s);
      io.unobserve(e.target);
    }
  },
  { threshold: 0.15 },
);
for (const el of document.querySelectorAll(".reveal")) io.observe(el);

// steps line that fills on scroll
const steps = document.getElementById("steps");
const rail = steps?.querySelector<HTMLElement>(".steps__rail i");
if (steps !== null && rail !== null && rail !== undefined) {
  const fill = () => {
    const r = steps.getBoundingClientRect();
    const vh = innerHeight;
    const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
    rail.style.setProperty("--p", p.toFixed(3));
  };
  addEventListener("scroll", fill, { passive: true });
  fill();
}

// documentation (/docs)
initDocs();
