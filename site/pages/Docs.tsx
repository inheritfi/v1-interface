// INHERITFI: documentation page (inheritfi.com/docs):
// side table of contents (collapsible on mobile), article, "On this page", previous and next, and local search. Everything is
// generated as HTML at build time; the client script (site/client/main.ts) only adds the search, the mobile table of contents, the
// highlighting of "On this page" and the copy-address button.
import type { DocsData } from "../docs/data";
import { DOC_PAGES, DOCS_OUTLINE } from "../docs/outline";
import { DOC_MODULES } from "../docs/registry";

export function docModule(id: string) {
  const m = DOC_MODULES[id];
  if (m === undefined) throw new Error(`Missing docs page module ${id}`);
  return m;
}

export function DocsPage({ id, d }: { id: string; d: DocsData }) {
  const i = DOC_PAGES.findIndex((x) => x.id === id);
  const page = DOC_PAGES[i];
  if (page === undefined) throw new Error(`Unknown docs page ${id}`);
  const prev = DOC_PAGES[i - 1];
  const next = DOC_PAGES[i + 1];
  const { Page, toc } = docModule(id);
  return (
    <>
      <div className="dbar">
        <button type="button" className="dbar__btn" aria-expanded="false" aria-controls="dside">
          Contents
        </button>
        <button type="button" className="dbar__search" data-focus-search="">
          Search docs
        </button>
      </div>
      <div className="docs">
        <aside className="dside" id="dside">
          <div className="dsearch">
            <input id="q" type="search" placeholder="Search docs" autoComplete="off" spellCheck={false} aria-label="Search docs" aria-controls="qres" />
            <kbd>/</kbd>
            <div className="qres" id="qres" role="listbox" hidden />
          </div>
          <nav className="dnav" aria-label="Documentation">
            {DOCS_OUTLINE.map((s) => (
              <div key={s.title} className="dnav__group">
                <div className="dnav__title">{s.title}</div>
                <ul>
                  {s.pages.map((pg) => (
                    <li key={pg.id}>
                      <a href={pg.path} aria-current={pg.id === id ? "page" : undefined}>
                        {pg.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <article className="dart" id="dart">
          <div className="crumb">
            {page.section} <span>/</span> {page.title}
          </div>
          <h1>{page.title}</h1>
          <Page d={d} />
          <nav className="pager" aria-label="Previous and next">
            {prev !== undefined && (
              <a className="prev" href={prev.path}>
                <small>Previous</small>
                <b>{prev.title}</b>
              </a>
            )}
            {next !== undefined && (
              <a className="next" href={next.path}>
                <small>Next</small>
                <b>{next.title}</b>
              </a>
            )}
          </nav>
        </article>
        <aside className="dtoc" aria-label="On this page">
          <div className="dtoc__title">On this page</div>
          <ul id="dtoc">
            {toc.map(([sid, title]) => (
              <li key={sid}>
                <a href={`#${sid}`} data-s={sid}>
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
