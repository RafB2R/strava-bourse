import Icon from "./Icon";

// Médaillon d'une Légende : son icône (lion de Warren Buffett…) en trait orange,
// dans un carré arrondi teinté, à la place de l'emoji.
export default function LegendIcon({ icon, size = 48, T }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
      background: T.accentBg, border: `0.5px solid ${T.accentBorder}`, color: T.accent,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon emoji={icon} size={Math.round(size * 0.52)} strokeWidth={1.6} style={{ verticalAlign: "middle" }} />
    </span>
  );
}
