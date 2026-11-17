import { useState } from "react";
import { getAddress, type Address } from "viem";
import { ownerLinkHash } from "../lib/section";
import { Button } from "./Button";
import { t } from "../i18n";

/**
 * A single link for heirs and contacts: …/#owner/0x{owner}. It only carries the
 * owner's address; it does not give access to anything (the contract only lets those in its lists act).
 */
export function ShareOwnerLink({ account }: { account: Address }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const link = `${window.location.origin}${window.location.pathname}${ownerLinkHash(getAddress(account))}`;
  return (
    <>
      <div className="ui-share-link">
        <Button
          onClick={() => {
            // Without a clipboard (non-secure context or missing API) the link is shown so it can be copied by hand.
            try {
              navigator.clipboard.writeText(link).then(
                () => {
                  setState("copied");
                },
                () => {
                  setState("manual");
                },
              );
            } catch {
              setState("manual");
            }
          }}
        >
          {t("share.copy")}
        </Button>
        {state === "copied" && (
          <span className="ui-share-link__status" role="status">
            {t("share.copied")}
          </span>
        )}
        {state === "manual" && (
          <input
            className="ui-input ui-input--address ui-mono"
            dir="ltr"
            readOnly
            aria-label={t("share.linkLabel")}
            value={link}
            onFocus={(e) => {
              e.target.select();
            }}
          />
        )}
      </div>
      <p className="screen__note ui-share-link__note">
        {t("share.note")}
      </p>
    </>
  );
}
