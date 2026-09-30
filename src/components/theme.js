// Thèmes Verio — isolés ici pour éviter l'import circulaire App.jsx <-> components
export const themes = {
  dark: {
    bg: "#111318",
    bgSecondary: "#1a1d24",
    bgCard: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.15)",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.55)",
    textFaint: "rgba(255,255,255,0.30)",
    accent: "#9FE1CB",
    accentBg: "rgba(159,225,203,0.10)",
    accentDark: "#0F6E56",
    onAccent: "#0F6E56", // texte posé sur un fond accent
    red: "#F08080",
    redBg: "rgba(240,128,128,0.10)",
    input: { background: "rgba(255,255,255,0.06)", color: "#f0f0f0", border: "rgba(255,255,255,0.14)" },
  },
  light: {
    bg: "#ECEEF2",
    bgSecondary: "#FFFFFF",
    bgCard: "#FFFFFF",
    border: "#DDE1E7",
    borderStrong: "#C4C9D4",
    text: "#0D0F14",
    textMuted: "#374151",
    textFaint: "#6B7280",
    accent: "#0F6E56",
    accentBg: "rgba(15,110,86,0.08)",
    accentDark: "#0F6E56",
    onAccent: "#FFFFFF", // texte posé sur un fond accent
    red: "#DC2626",
    redBg: "rgba(220,38,38,0.08)",
    cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
