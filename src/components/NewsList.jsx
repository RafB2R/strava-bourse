import { useState, useEffect } from "react";

// Articles de presse récents sur un sujet (Google Actualités, via /api/news).
// Chaque article s'ouvre dans un nouvel onglet, sur le site du journal.
const fmtDate = iso => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400e3);
  if (days < 1) return "aujourd'hui";
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: days > 300 ? "numeric" : undefined });
};

export default function NewsList({ query, T }) {
  const [state, setState] = useState({ query: null, items: [], error: false });
  useEffect(() => {
    let ignore = false;
    fetch(`/api/news?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(items => { if (!ignore) setState({ query, items: Array.isArray(items) ? items : [], error: !Array.isArray(items) }); })
      .catch(() => { if (!ignore) setState({ query, items: [], error: true }); });
    return () => { ignore = true; };
  }, [query]);

  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "4px 14px", marginBottom: 12 };
  const empty = text => <div style={{ ...card, textAlign: "center", color: T.textFaint, fontSize: 13, padding: "2rem" }}>{text}</div>;
  if (state.query !== query) return empty("Chargement des articles…");
  if (state.error) return empty("Articles indisponibles pour le moment.");
  if (state.items.length === 0) return empty("Aucun article récent.");
  return (
    <div>
      <div style={card}>
        {state.items.map((a, i) => (
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", padding: "12px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, textDecoration: "none" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{a.title}</div>
            <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>{[a.source, a.date && fmtDate(a.date)].filter(Boolean).join(" · ")}</div>
          </a>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center" }}>Articles récents via Google Actualités</div>
    </div>
  );
}
