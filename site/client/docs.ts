// INHERITFI: behavior of the documentation pages (only if the page has the /docs article): collapsible
// table of contents on mobile, highlighting of "On this page", copying addresses and local search over the index that the page
// loads as a data file (docs/search-index.js). No network or storage; text is always written with
// textContent, never as HTML.

interface IndexEntry {
  readonly u: string;
  readonly t: string;
  readonly h: string;
  readonly x: string;
}

declare global {
  interface Window {
    INHERITFI_DOCS_INDEX?: readonly IndexEntry[];
  }
}

export function initDocs(): void {
  const art = document.getElementById("dart");
  const side = document.getElementById("dside");
  const barBtn = document.querySelector<HTMLButtonElement>(".dbar__btn");
  if (art === null || side === null || barBtn === null) return;

  const setSide = (open: boolean) => {
    side.classList.toggle("is-open", open);
    barBtn.setAttribute("aria-expanded", String(open));
  };
  barBtn.addEventListener("click", () => {
    setSide(!side.classList.contains("is-open"));
  });
  addEventListener("pageshow", (e) => {
    if (e.persisted) setSide(false);
  });

  // "On this page": the visible section stays highlighted
  const toc = document.getElementById("dtoc");
  if (toc !== null) {
    const spy = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          for (const a of toc.querySelectorAll<HTMLAnchorElement>("a")) a.classList.toggle("is-on", a.dataset.s === e.target.id);
        }
      },
      { rootMargin: "-100px 0px -70% 0px" },
    );
    for (const h of art.querySelectorAll("h2[id]")) spy.observe(h);
  }

  // copying addresses; if the clipboard is not available, the address stays selected so it can be copied by hand
  art.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLButtonElement>(".copy") : null;
    if (b === null) return;
    const value = b.dataset.copy ?? "";
    const done = () => {
      b.textContent = "Copied";
      b.classList.add("is-done");
      setTimeout(() => {
        b.textContent = "Copy";
        b.classList.remove("is-done");
      }, 1500);
    };
    const select = () => {
      const code = b.previousElementSibling;
      const sel = getSelection();
      if (code === null || sel === null) return;
      const r = document.createRange();
      r.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(r);
    };
    navigator.clipboard.writeText(value).then(done, select);
  });

  // local search: every word must appear; the title weighs more than the text
  const q = document.getElementById("q");
  const res = document.getElementById("qres");
  const box = document.querySelector(".dsearch");
  if (!(q instanceof HTMLInputElement) || res === null || box === null) return;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const idx = (window.INHERITFI_DOCS_INDEX ?? []).map((e) => ({ e, nh: norm(`${e.h} ${e.t}`), nx: norm(e.x) }));
  let sel = -1;

  /** Fragment of the text around the first match, with the matches marked (<mark>). */
  const snippet = (text: string, terms: readonly string[]): Node[] => {
    const n = norm(text);
    const hits = terms.map((t) => n.indexOf(t)).filter((x) => x >= 0);
    const at = Math.max(0, Math.min(...hits) - 40);
    const s = (at > 0 ? "…" : "") + text.slice(at, at + 150) + (at + 150 < text.length ? "…" : "");
    const ns = norm(s);
    const marks: boolean[] = Array.from({ length: s.length }, () => false);
    for (const t of terms) for (let i = ns.indexOf(t); i >= 0; i = ns.indexOf(t, i + t.length)) for (let k = i; k < i + t.length; k++) marks[k] = true;
    const out: Node[] = [];
    let i = 0;
    while (i < s.length) {
      const m = marks[i] === true;
      let j = i;
      while (j < s.length && (marks[j] === true) === m) j++;
      const part = s.slice(i, j);
      if (m) {
        const el = document.createElement("mark");
        el.textContent = part;
        out.push(el);
      } else out.push(document.createTextNode(part));
      i = j;
    }
    return out;
  };

  const search = () => {
    const terms = norm(q.value)
      .split(/\s+/)
      .filter((t) => t.length > 1);
    sel = -1;
    if (terms.length === 0) {
      res.hidden = true;
      return;
    }
    const hits = idx
      .filter((r) => terms.every((t) => r.nh.includes(t) || r.nx.includes(t)))
      .map((r) => ({ r, score: terms.reduce((s, t) => s + (r.nh.includes(t) ? 10 : 0) + (r.nx.split(t).length - 1), 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    res.replaceChildren();
    if (hits.length === 0) {
      const empty = document.createElement("div");
      empty.className = "qres__empty";
      empty.textContent = "No results.";
      res.append(empty);
    }
    hits.forEach(({ r }, k) => {
      const a = document.createElement("a");
      a.setAttribute("role", "option");
      a.id = `qr${String(k)}`;
      a.href = r.e.u;
      const small = document.createElement("small");
      small.textContent = r.e.t;
      const b = document.createElement("b");
      b.textContent = r.e.h;
      const span = document.createElement("span");
      span.append(...snippet(r.e.x, terms));
      a.append(small, b, span);
      res.append(a);
    });
    res.hidden = false;
  };
  q.addEventListener("input", search);
  q.addEventListener("focus", search);
  q.addEventListener("keydown", (e) => {
    const items = [...res.querySelectorAll<HTMLAnchorElement>("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((a, k) => {
        a.setAttribute("aria-selected", String(k === sel));
      });
      items[sel]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && items.length > 0) {
      e.preventDefault();
      const target = items[Math.max(sel, 0)];
      if (target !== undefined) location.href = target.href;
    } else if (e.key === "Escape") {
      res.hidden = true;
      q.blur();
    }
  });
  res.addEventListener("click", () => {
    res.hidden = true;
  });
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Node) || !box.contains(e.target)) res.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== q && !(document.activeElement instanceof HTMLInputElement)) {
      e.preventDefault();
      q.focus();
    }
  });
  document.querySelector("[data-focus-search]")?.addEventListener("click", () => {
    setSide(true);
    q.focus();
  });
}
