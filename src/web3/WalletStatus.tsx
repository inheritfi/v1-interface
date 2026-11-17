import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useConnection, useConnectors, useDisconnect, useReconnect, useSwitchChain } from "wagmi";
import { Address } from "../components/Address";
import { Button } from "../components/Button";
import { t } from "../i18n";
import { wagmiConfig } from "./config";
import { chain } from "./network";
import { WalletDialog } from "./WalletDialog";
import { fixedRows, otherRows, usableConnectors, type Announced } from "./wallets";

// The extensions that announced themselves (EIP-6963), read from wagmi's own discovery store. wagmi keeps one connector
// per identifier, so this list is the only place where two extensions declaring the same identifier can be seen.
const discovery = wagmiConfig._internal.mipd;
type Providers = NonNullable<typeof discovery>["getProviders"] extends () => infer R ? R : never;
const NONE: Providers = [];
const subscribe = (onChange: () => void) => {
  const stop = discovery?.subscribe(onChange);
  return () => {
    stop?.();
  };
};
const providersNow = () => discovery?.getProviders() ?? NONE;

/**
 * Account box. Disconnected: "Connect wallet" opens the dialog (WalletDialog). Only usable wallets (wallets.ts) are
 * ever connected or reconnected: wagmi's own reconnection is off (main.tsx) because it would try every extension;
 * here the page reconnects once, and only to the wallet the user chose last, if it is still usable. A connection to
 * anything else is closed at once.
 */
export function WalletStatus({ disclaimerUrl }: { readonly disclaimerUrl: string }) {
  const connection = useConnection();
  const connectors = useConnectors();
  const reconnect = useReconnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const providers = useSyncExternalStore(subscribe, providersNow);
  const announced = useMemo<readonly Announced[]>(
    () => providers.map(({ info }) => ({ uuid: info.uuid, rdns: info.rdns, name: info.name, icon: info.icon })),
    [providers],
  );
  const fixed = fixedRows(connectors, announced);
  const others = otherRows(connectors, announced);
  const usable = usableConnectors(connectors, announced);

  // The wallet chosen last (wagmi keeps its identifier). Read once.
  const [recent, setRecent] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    Promise.resolve(wagmiConfig.storage?.getItem("recentConnectorId")).then(
      (v) => {
        setRecent(typeof v === "string" ? v : null);
      },
      () => {
        setRecent(null);
      },
    );
  }, []);

  // Reconnect once, to that wallet only, as soon as it has announced itself and is usable.
  const reconnectTried = useRef(false);
  useEffect(() => {
    if (reconnectTried.current || typeof recent !== "string" || connection.status !== "disconnected") return;
    const target = usable.find((c) => c.id === recent);
    if (target === undefined) return;
    reconnectTried.current = true;
    reconnect.mutate({ connectors: [target] });
  }, [recent, usable, reconnect, connection.status]);

  // Defence in depth: a connection to anything that is not usable is closed at once.
  const current = connection.status === "connected" ? connection.connector : undefined;
  const allowed = current === undefined || usable.some((c) => c.uid === current.uid);
  useEffect(() => {
    if (current !== undefined && !allowed && !disconnect.isPending) disconnect.mutate({ connector: current });
  }, [current, allowed, disconnect]);

  if (connection.status === "connected" && allowed) {
    const wrongChain = connection.chainId !== chain.id;
    return (
      <div className="app__account" data-state={wrongChain ? "wrong-chain" : "connected"}>
        <span>{wrongChain ? t("wallet.wrongNetwork") : t("wallet.connected")}</span>
        <Address address={connection.address} />
        {wrongChain && (
          <Button
            variant="primary"
            title={t("wallet.switchTitle", { name: chain.name, chain: chain.id })}
            disabled={switchChain.isPending}
            onClick={() => {
              switchChain.mutate({ chainId: chain.id });
            }}
          >
            {t("wallet.switch")}
          </Button>
        )}
        <Button
          onClick={() => {
            disconnect.mutate();
          }}
        >
          {t("wallet.disconnect")}
        </Button>
      </div>
    );
  }

  const restoring = connection.status === "connecting" || connection.status === "reconnecting";
  return (
    <Fragment>
      <div className="app__account" data-state="disconnected">
        <span>{t("wallet.none")}</span>
        {/* A plain button with the classes of <Button variant="primary">: the dialog needs a ref to return focus. */}
        <button
          ref={opener}
          type="button"
          className="ui-button ui-button--primary"
          aria-haspopup="dialog"
          disabled={restoring}
          onClick={() => {
            setOpen(true);
          }}
        >
          {restoring ? t("wallet.connecting") : t("wallet.connect")}
        </button>
      </div>
      <WalletDialog
        open={open}
        onClose={() => {
          setOpen(false);
          opener.current?.focus({ preventScroll: true });
        }}
        fixed={fixed}
        others={others}
        disclaimerUrl={disclaimerUrl}
        busy={restoring || connection.status === "connected"}
      />
    </Fragment>
  );
}
