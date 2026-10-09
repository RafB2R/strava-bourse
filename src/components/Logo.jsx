import { MARK_PATH, MARK_VIEWBOX, MARK_STROKE } from "../logoMark";

// Logo Verio : le symbole suivi de « erio ».

export function LogoMark({ size = 24, color = "#FF6B2C", style }) {
  return (
    <svg width={size * (288 / 274)} height={size} viewBox={MARK_VIEWBOX} aria-hidden="true" style={{ display: "block", flexShrink: 0, ...style }}>
      <path d={MARK_PATH} fill="none" stroke={color} strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// « size » : taille du texte ; le symbole monte jusqu'en haut du « i », posé sur la ligne de base
export default function Logo({ size = 20, color = "#FFFFFF", accent = "#FF6B2C", style, onClick }) {
  return (
    <span role="img" aria-label="Verio" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "flex-end", gap: size * 0.1, fontSize: size, fontWeight: 600, lineHeight: 1, color, letterSpacing: "-0.01em", cursor: onClick ? "pointer" : undefined, ...style }}>
      <LogoMark size={size * 0.8} color={accent} style={{ marginBottom: size * 0.13 }} />
      <span aria-hidden="true" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>erio</span>
    </span>
  );
}
