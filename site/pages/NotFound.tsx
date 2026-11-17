// INHERITFI: 404 error page (the VPS server returns it for any address that does not exist), with the
// style of the authorized disclaimer.

import { st } from "../i18n";

export function NotFound() {
  return (
    <div className="legal legal--short">
      <div className="legal__head reveal">
        <h1>{st("notFound.title")}</h1>
        <p className="nf__text">{st("notFound.body")}</p>
        <a className="btn btn--primary" href="/">
          {st("notFound.home")}
        </a>
      </div>
    </div>
  );
}
