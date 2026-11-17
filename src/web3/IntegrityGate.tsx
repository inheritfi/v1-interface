import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { Notice } from "../components/Notice";
import { useIntegrity } from "./useIntegrity";
import { t } from "../i18n";

/** Nothing of the screen is shown until it is checked that the contracts on the chain are those of the manifest. */
export function IntegrityGate({ children }: { children: ReactNode }) {
  const integrity = useIntegrity();

  if (integrity.isPending) {
    return (
      <Notice tone="info" title={t("integrity.verifyingTitle")}>
        {t("integrity.verifying")}
      </Notice>
    );
  }

  if (integrity.isError) {
    return (
      <div className="screen">
        <Notice tone="error" title={t("integrity.unreachableTitle")}>
          {t("integrity.unreachable")}
        </Notice>
        <div className="ui-actions">
          <Button
            onClick={() => {
              void integrity.refetch();
            }}
          >
            {t("common.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  const { problems, warnings } = integrity.data;
  if (problems.length > 0) {
    return (
      <div className="screen">
        <Notice tone="error" title={t("integrity.mismatchTitle")}>
          {t("integrity.mismatch")}
        </Notice>
        <ul className="screen__findings">
          {problems.map((p) => (
            <li key={`${p.subject}:${p.detail}`}>
              <b>{p.subject}</b> {p.detail}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      {warnings.length > 0 && (
        <Notice tone="notice" title={t("integrity.ownershipTitle")}>
          {warnings.map((w) => `${w.subject}: ${w.detail}`).join(" ")}
        </Notice>
      )}
      {children}
    </>
  );
}
