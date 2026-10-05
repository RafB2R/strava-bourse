import { useState, useEffect } from "react";
import { canPromptInstall, onInstallAvailable, promptInstall, isStandalone, isIosSafari } from "../pwa";

const DISMISS_KEY = "verio-install-dismissed";
const DISMISS_DAYS = 30;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

// Bandeau « Installe Verio » (mobile) : bouton d'installation sur Android,
// marche à suivre sur iPhone. Masqué une fois installé, ou 30 jours si fermé.
export default function InstallBanner({ T }) {
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed());
  const ios = isIosSafari();

  useEffect(() => onInstallAvailable(() => setCanInstall(canPromptInstall())), []);

  if (hidden || (!canInstall && !ios)) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* navigation privée */ }
    setHidden(true);
  }

  async function install() {
    if (await promptInstall()) setHidden(true);
  }

  return (
    <div role="region" aria-label="Installer l'application" style={{ display: "flex", alignItems: "center", gap: 12, background: T.bgCard, border: `0.5px solid ${T.accent}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "12px 14px", marginBottom: 16 }}>
      <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Installe Verio sur ton téléphone</div>
        {ios ? (
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.45, marginTop: 2 }}>
            Touche <b>Partager</b> <span aria-hidden="true">⬆️</span> en bas de Safari, puis <b>« Sur l'écran d'accueil »</b>.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Une icône sur ton écran d'accueil, en plein écran.</div>
        )}
      </div>
      {!ios && (
        <button onClick={install} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Installer</button>
      )}
      <button onClick={dismiss} aria-label="Fermer" style={{ background: "none", border: "none", color: T.textFaint, fontSize: 14, cursor: "pointer", padding: 4, flexShrink: 0 }}>✕</button>
    </div>
  );
}
