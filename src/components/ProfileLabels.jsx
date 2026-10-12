import { useState, useEffect } from "react";
import { fetchLabels } from "../labels";
import Icon from "./Icon";

// Étiquettes automatiques d'un membre. « compact » : texte court pour les listes
// (recherche, suggestions, amis) ; sinon des pastilles, un clic explique la règle.
export default function ProfileLabels({ userId, T, compact = false, prefix = "" }) {
  const [state, setState] = useState({ userId: null, labels: [] });
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetchLabels(userId).then(labels => { if (!ignore) setState({ userId, labels }); });
    return () => { ignore = true; };
  }, [userId]);
  const labels = state.userId === userId ? state.labels : [];
  if (!labels.length) return null;

  if (compact) return <>{prefix}{labels.map(l => l.name).join(" · ")}</>;

  const current = labels.find(l => l.id === open);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {labels.map(l => (
          <button key={l.id} onClick={() => setOpen(o => (o === l.id ? null : l.id))} aria-expanded={open === l.id} title={l.why}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: `0.5px solid ${T.accentBorder}`, background: T.accentBg, color: T.accent }}>
            <Icon emoji={l.icon} size={12} />{l.name}
          </button>
        ))}
      </div>
      {current && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{current.why}</div>}
    </div>
  );
}
