import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Landing from "./Landing";
import Auth from "./components/Auth";
import Profil from "./components/Profil";
import Portfolio from "./components/Portfolio";
import Feed from "./components/Feed";
import Explore from "./components/Explore";
import Notifications from "./components/Notifications";
import KYC from "./components/KYC";

const TABS = [
  { id: "feed", label: "Fil", icon: "🏠" },
  { id: "explore", label: "Explore", icon: "🔍" },
  { id: "portfolio", label: "Portef.", icon: "📊" },
  { id: "profil", label: "Profil", icon: "👤" },
];

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  if (hour < 12) return `Bonjour ${firstName} ☀️`;
  if (hour < 18) return `Bon après-midi ${firstName} 👋`;
  return `Bonsoir ${firstName} 🌙`;
}

// Thèmes
const themes = {
  dark: {
    bg: "#111318",
    bgSecondary: "#1a1d24",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.12)",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.4)",
    textFaint: "rgba(255,255,255,0.2)",
    accent: "#9FE1CB",
    accentBg: "rgba(159,225,203,0.08)",
    accentText: "#0F6E56",
    navActive: "#9FE1CB",
    navInactive: "rgba(255,255,255,0.3)",
    card: "rgba(255,255,255,0.03)",
  },
  light: {
    bg: "#f5f6fa",
    bgSecondary: "#ffffff",
    border: "rgba(0,0,0,0.07)",
    borderStrong: "rgba(0,0,0,0.12)",
    text: "#111318",
    textMuted: "rgba(0,0,0,0.45)",
    textFaint: "rgba(0,0,0,0.25)",
    accent: "#0F6E56",
    accentBg: "rgba(15,110,86,0.07)",
    accentText: "#0F6E56",
    navActive: "#0F6E56",
    navInactive: "rgba(0,0,0,0.35)",
    card: "rgba(0,0,0,0.03)",
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem("verio-theme") || "light");

  const T = themes[themeKey];

  function toggleTheme() {
    const next = themeKey === "dark" ? "light" : "dark";
    setThemeKey(next);
    localStorage.setItem("verio-theme", next);
  }

  // Desktop = largeur > 900px
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 900);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth > 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); setShowAuth(false); }
    });
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: "system-ui" }}>
      Chargement…
    </div>
  );

  if (!session && !showAuth) return <Landing onStart={() => setShowAuth(true)} />;
  if (!session && showAuth) return <Auth />;

  // ─── DESKTOP LAYOUT ───
  if (isDesktop) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", display: "flex" }}>

        {/* Sidebar gauche */}
        <div style={{
          width: 240, flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0,
          background: T.bgSecondary, borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", padding: "24px 16px", overflowY: "auto"
        }}>
          {/* Logo */}
          <div style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 32, paddingLeft: 8 }}>
            ve<span style={{ color: T.accent }}>rio</span>
          </div>

          {/* Nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: tab === t.id ? T.accentBg : "transparent",
                color: tab === t.id ? T.accent : T.textMuted,
                cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t.id ? 700 : 400,
                fontSize: 14, textAlign: "left", transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Bas sidebar */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Toggle thème */}
            <button onClick={toggleTheme} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              borderRadius: 10, border: "none", background: "transparent",
              color: T.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 13
            }}>
              <span>{themeKey === "dark" ? "☀️" : "🌙"}</span>
              {themeKey === "dark" ? "Mode clair" : "Mode sombre"}
            </button>

            {/* Profil + déconnexion */}
            {profile?.full_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: T.accentText, fontWeight: 700, flexShrink: 0 }}>
                  {profile.full_name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.full_name}</div>
                </div>
                <button onClick={handleLogout} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16 }} title="Déconnexion">↩</button>
              </div>
            )}
          </div>
        </div>

        {/* Zone principale */}
        <div style={{ marginLeft: 240, flex: 1, display: "flex", minHeight: "100vh" }}>

          {/* Centre — contenu */}
          <div style={{ flex: 1, maxWidth: 680, borderRight: `1px solid ${T.border}` }}>
            {/* Bannière KYC */}
            {profile && !profile.kyc_complete && !showKYC && (
              <div style={{ background: T.accentBg, borderBottom: `1px solid ${T.border}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>Complète ton profil investisseur</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>Personnalise ton expérience en 2 minutes</div>
                </div>
                <button onClick={() => setShowKYC(true)} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  Commencer →
                </button>
              </div>
            )}

            {showKYC && (
              <KYC session={session} profile={profile}
                onComplete={() => { setShowKYC(false); loadProfile(session.user.id); }}
                onSkip={() => setShowKYC(false)} />
            )}

            <div style={{ padding: "24px" }}>
              {tab === "feed" && <Feed session={session} />}
              {tab === "explore" && <Explore session={session} />}
              {tab === "portfolio" && <Portfolio session={session} profile={profile} />}
              {tab === "profil" && <Profil profile={profile} session={session} />}
            </div>
          </div>

          {/* Droite — widget */}
          <div style={{ width: 300, flexShrink: 0, padding: "24px 20px" }}>
            {/* Greeting */}
            {profile?.full_name && (
              <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{getGreeting(profile.full_name)}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Bienvenue sur Verio</div>
              </div>
            )}

            {/* Notifications widget */}
            <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>🔔 Notifications</div>
              <Notifications session={session} inline />
            </div>

            {/* Marchés rapides */}
            <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>📈 Marchés</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Ouvre l'onglet Explore pour les données en temps réel.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── MOBILE LAYOUT ───
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: T.bgSecondary, borderBottom: `0.5px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>ve<span style={{ color: T.accent }}>rio</span></div>
            {profile?.full_name && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                {getGreeting(profile.full_name)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleTheme} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, cursor: "pointer" }}>
              {themeKey === "dark" ? "☀️" : "🌙"}
            </button>
            <Notifications session={session} />
            <button onClick={handleLogout} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
              Déco.
            </button>
          </div>
        </div>
      </div>

      {/* Bannière KYC */}
      {profile && !profile.kyc_complete && !showKYC && (
        <div style={{ background: T.accentBg, borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "10px 1rem", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>Complète ton profil investisseur</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Personnalise ton expérience en 2 minutes</div>
            </div>
            <button onClick={() => setShowKYC(true)} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Commencer →
            </button>
          </div>
        </div>
      )}

      {showKYC && (
        <KYC session={session} profile={profile}
          onComplete={() => { setShowKYC(false); loadProfile(session.user.id); }}
          onSkip={() => setShowKYC(false)} />
      )}

      {/* Contenu */}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>
        {tab === "feed" && <Feed session={session} />}
        {tab === "explore" && <Explore session={session} />}
        {tab === "portfolio" && <Portfolio session={session} profile={profile} />}
        {tab === "profil" && <Profil profile={profile} session={session} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.bgSecondary, borderTop: `0.5px solid ${T.border}` }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "12px 4px 14px", fontSize: 10, background: "none", border: "none",
              color: tab === t.id ? T.navActive : T.navInactive,
              cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t.id ? 600 : 400,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
