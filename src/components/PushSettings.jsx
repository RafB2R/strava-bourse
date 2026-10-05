import { useState, useEffect } from "react";
import { pushStatus, enablePush, disablePush } from "../push";

// Encart du Profil : activer les notifications push sur cet appareil
export default function PushSettings({ T }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    pushStatus().then(s => { if (!ignore) setStatus(s); }).catch(() => { if (!ignore) setStatus("unsupported"); });
    return () => { ignore = true; };
  }, []);

  if (!status) return null;

  async function toggle() {
    setBusy(true); setError("");
    try {
      setStatus(status === "on" ? await disablePush() : await enablePush());
    } catch (e) {
      setError(e.message || "Activation impossible.");
    }
    setBusy(false);
  }

  const on = status === "on";
  const text = {
    unsupported: "Ce navigateur ne permet pas les notifications. Utilise Chrome, Edge, Firefox ou Safari à jour.",
    "ios-other-browser": "Sur iPhone, les notifications passent par Safari : ouvre Verio dans Safari, installe-le sur l'écran d'accueil, puis ouvre-le depuis l'icône.",
    "ios-too-old": "Les notifications demandent iOS 16.4 ou plus récent. Mets ton iPhone à jour (Réglages → Général → Mise à jour logicielle).",
    reload: "Ferme et rouvre Verio pour finir l'installation, puis reviens ici pour activer les notifications.",
    "install-first": "Sur iPhone, installe d'abord Verio sur ton écran d'accueil (encart ci-dessus), puis ouvre-le depuis l'icône pour activer les notifications.",
    denied: "Les notifications sont bloquées pour Verio. Réactive-les dans les réglages du téléphone (Réglages → Notifications → Verio) ou du navigateur.",
    off: "Messages, demandes d'ami, commentaires et fins de sondage, même quand Verio est fermé.",
    on: "Activées sur cet appareil : messages, demandes d'ami, commentaires et fins de sondage.",
  }[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.bgCard, border: `0.5px solid ${on ? T.accent : T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "12px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 26, flexShrink: 0 }} aria-hidden="true">{on ? "🔔" : "🔕"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Notifications sur ce téléphone</div>
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.45, marginTop: 2 }}>{text}</div>
        {error && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{error}</div>}
      </div>
      {(status === "on" || status === "off") && (
        <button onClick={toggle} disabled={busy} aria-pressed={on}
          style={{ background: on ? "none" : T.accent, border: on ? `0.5px solid ${T.borderStrong}` : "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, color: on ? T.textMuted : T.onAccent, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          {busy ? "…" : on ? "Désactiver" : "Activer"}
        </button>
      )}
    </div>
  );
}
