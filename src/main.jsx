import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initPwa } from "./pwa";

initPwa();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);