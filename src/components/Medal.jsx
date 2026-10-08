import { T as TLive } from "../theme";

// Médaille d'un badge, dessinée (plus d'emoji) : un hexagone au trait couleur du métal,
// teinté, avec 1 à 3 barres pour bronze, argent, or, et une pierre taillée pour le diamant.
// « tier » garde l'emoji comme identifiant (🥉 🥈 🥇 💎), comme en base.
const LEVEL = { "🥉": 1, "🥈": 2, "🥇": 3, "💎": 4 };
const HEX = "M12 2.2 20.5 7.1v9.8L12 21.8 3.5 16.9V7.1Z";

export default function Medal({ tier, size = 20, T = TLive, dim = false, title }) {
  const level = LEVEL[tier];
  if (!level) return null;
  const color = T.medals?.[tier] || T.accent;
  const bars = level < 4 ? Array.from({ length: level }, (_, i) => 12 + (i - (level - 1) / 2) * 3.2) : [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : "true"}
      style={{ flexShrink: 0, verticalAlign: "-0.2em", opacity: dim ? 0.25 : 1 }}>
      <path d={HEX} fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {bars.map(x => <path key={x} d={`M${x} 9v6`} stroke={color} strokeWidth="1.9" strokeLinecap="round" />)}
      {level === 4 && <path d="M8.6 10.2 10.2 8h3.6l1.6 2.2L12 15.6Z M8.6 10.2h6.8" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />}
    </svg>
  );
}
