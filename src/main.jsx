import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initPwa } from "./pwa";
import { i18nReady } from "./i18n";

initPwa();

// L'appli n'est chargée qu'une fois la langue prête (dictionnaire anglais téléchargé si besoin)
i18nReady.then(() => import("./App")).then(({ default: App }) => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
