import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { App } from "./App";
import { queryClient, wagmiConfig } from "./web3/config";
import { initLocale } from "./i18n/browser";
import { LanguageProvider } from "./i18n/LanguageProvider";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";

// Language before the first render: the one chosen before, the browser's if it is active, or English.
initLocale();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    {/* reconnectOnMount off: wagmi would try every extension; WalletStatus reconnects only to a supported wallet. */}
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
