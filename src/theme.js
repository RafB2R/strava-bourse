// Thèmes Verio — isolés ici pour éviter l'import circulaire App.jsx <-> components
export const themes = {
  dark: {
    bg: "#111318",
    bgSecondary: "#1a1d24",
    bgCard: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.15)",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.70)",
    textFaint: "rgba(255,255,255,0.52)", // ≥ 4,5:1 sur les fonds sombres
    accent: "#9FE1CB",
    accentBg: "rgba(159,225,203,0.10)",
    accentDark: "#0F6E56",
    onAccent: "#0A4A3B", // texte posé sur un fond accent
    red: "#F08080",
    redBg: "rgba(240,128,128,0.10)",
    accentBorder: "rgba(159,225,203,0.25)",
    bgSubtle: "rgba(255,255,255,0.04)", // encart posé dans une carte
    cardShadow: "none",
    // Couleurs d'accent pour textes et étiquettes (lisibles sur fond sombre)
    gold: "#FFD700",
    yellow: "#F0CB7B",
    purple: "#AFA9EC",
    blue: "#7BB8F0",
    orange: "#F0997B",
    medals: { "🥉": "#CD7F32", "🥈": "#C0C0C0", "🥇": "#FFD700", "💎": "#B9F2FF" },
    avatars: ["rgba(159,225,203,0.12)|#9FE1CB", "rgba(240,153,123,0.12)|#F0997B", "rgba(175,169,236,0.12)|#AFA9EC", "rgba(123,184,240,0.12)|#7BB8F0", "rgba(240,203,123,0.12)|#F0CB7B"],
    input: { background: "rgba(255,255,255,0.06)", color: "#f0f0f0", border: "rgba(255,255,255,0.14)" },
  },
  light: {
    bg: "#ECEEF2",
    bgSecondary: "#FFFFFF",
    bgCard: "#FFFFFF",
    border: "#D5DAE1",
    borderStrong: "#B8BFCB",
    text: "#0D0F14",
    textMuted: "#374151",
    textFaint: "#596170", // ≥ 4,5:1 sur le fond de page comme sur les cartes
    accent: "#0F6E56",
    accentBg: "rgba(15,110,86,0.08)",
    accentDark: "#0F6E56",
    onAccent: "#FFFFFF", // texte posé sur un fond accent
    red: "#C42020",
    redBg: "rgba(220,38,38,0.08)",
    accentBorder: "rgba(15,110,86,0.28)",
    bgSubtle: "#F3F5F8", // encart posé dans une carte blanche
    cardShadow: "0 1px 3px rgba(16,24,40,0.07)",
    // Versions foncées des couleurs d'accent : ≥ 4,5:1 sur blanc et sur leur fond teinté
    gold: "#7A5A00",
    yellow: "#8A5300",
    purple: "#5446C2",
    blue: "#1B5DA6",
    orange: "#AD3E1A",
    medals: { "🥉": "#8F5317", "🥈": "#5F6673", "🥇": "#7A5A00", "💎": "#0E6F86" },
    avatars: ["rgba(15,110,86,0.10)|#0F6E56", "rgba(173,62,26,0.10)|#AD3E1A", "rgba(84,70,194,0.10)|#5446C2", "rgba(27,93,166,0.10)|#1B5DA6", "rgba(138,83,0,0.10)|#8A5300"],
    input: { background: "#F9FAFB", color: "#0D0F14", border: "#D1D5DB" },
  },
};

export function getThemeKey() {
  try {
    const saved = localStorage.getItem("verio-theme");
    if (saved && themes[saved]) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

// T "live" : lit le thème courant à chaque accès.
// Sert de valeur par défaut aux sous-composants qui ne reçoivent pas T en prop.
export const T = new Proxy({}, {
  get: (_, key) => themes[getThemeKey()][key],
});

// Couleurs [fond, texte] d'un avatar à initiales, stables pour un même nom
export function avatarColors(name, theme = T) {
  const list = theme.avatars;
  return list[(name?.charCodeAt(0) || 0) % list.length].split("|");
}
