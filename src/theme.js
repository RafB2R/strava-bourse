// Thèmes Verio — isolés ici pour éviter l'import circulaire App.jsx <-> components
// Inspiré de l'univers Sycomore AM : fonds très sombres, orange franc en couleur
// principale, cartes pleines et contrastées. Le vert (up) est réservé aux hausses et le
// rouge aux baisses : l'orange n'indique jamais une performance.
export const themes = {
  dark: {
    bg: "#0D0D0D",
    bgSecondary: "#151515",
    bgCard: "#1A1A1A",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.16)",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.72)",
    textFaint: "rgba(255,255,255,0.54)", // ≥ 4,5:1 sur les fonds sombres
    accent: "#FF6B2C",
    accentBg: "rgba(255,107,44,0.12)",
    accentDark: "#C2410C",
    onAccent: "#0D0D0D", // texte posé sur un fond accent (contraste ≥ 7:1)
    accentBorder: "rgba(255,107,44,0.38)",
    up: "#3DD68C",
    upBg: "rgba(61,214,140,0.12)",
    red: "#FF6B6B",
    redBg: "rgba(255,107,107,0.12)",
    bgSubtle: "rgba(255,255,255,0.05)", // encart posé dans une carte
    cardShadow: "none",
    // Couleurs d'accent pour textes et étiquettes (lisibles sur fond sombre)
    gold: "#FFD166",
    yellow: "#F4C46A",
    purple: "#B39DFF",
    blue: "#6FB6FF",
    orange: "#FF9A62",
    medals: { "🥉": "#CD7F32", "🥈": "#C0C0C0", "🥇": "#FFD166", "💎": "#B9F2FF" },
    avatars: ["rgba(255,107,44,0.14)|#FF9A62", "rgba(179,157,255,0.14)|#B39DFF", "rgba(111,182,255,0.14)|#6FB6FF", "rgba(61,214,140,0.14)|#3DD68C", "rgba(255,107,170,0.14)|#FF7BB0"],
    input: { background: "#202020", color: "#F2F2F2", border: "rgba(255,255,255,0.14)" },
  },
  light: {
    bg: "#F4F2EF",
    bgSecondary: "#FFFFFF",
    bgCard: "#FFFFFF",
    border: "#E2DED8",
    borderStrong: "#C9C3BA",
    text: "#111111",
    textMuted: "#3B3B3B",
    textFaint: "#5E5A55", // ≥ 4,5:1 sur le fond de page comme sur les cartes
    accent: "#C2410C",
    accentBg: "rgba(194,65,12,0.08)",
    accentDark: "#9A3412",
    onAccent: "#FFFFFF", // texte posé sur un fond accent
    accentBorder: "rgba(194,65,12,0.30)",
    up: "#0F7A4E",
    upBg: "rgba(15,122,78,0.09)",
    red: "#C42020",
    redBg: "rgba(220,38,38,0.08)",
    bgSubtle: "#F7F5F2", // encart posé dans une carte blanche
    cardShadow: "0 1px 3px rgba(17,17,17,0.06)",
    // Versions foncées des couleurs d'accent : ≥ 4,5:1 sur blanc et sur leur fond teinté
    gold: "#7A5A00",
    yellow: "#8A5300",
    purple: "#5446C2",
    blue: "#1B5DA6",
    orange: "#AD3E1A",
    medals: { "🥉": "#8F5317", "🥈": "#5F6673", "🥇": "#7A5A00", "💎": "#0E6F86" },
    avatars: ["rgba(194,65,12,0.10)|#C2410C", "rgba(84,70,194,0.10)|#5446C2", "rgba(27,93,166,0.10)|#1B5DA6", "rgba(15,122,78,0.10)|#0F7A4E", "rgba(190,24,93,0.10)|#BE185D"],
    input: { background: "#FAF9F7", color: "#111111", border: "#D6D1CA" },
  },
};

export function getThemeKey() {
  try {
    const saved = localStorage.getItem("verio-theme");
    if (saved && themes[saved]) return saved;
    return "dark"; // le thème sombre est l'univers de Verio ; le clair reste au choix
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
