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
import ProfilPublic from "./components/ProfilPublic";

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

export const themes = {
  dark: {
    bg: "#111318", bgSecondary: "#1a1d24", bgCard: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
    text: "#ffffff", textMuted: "rgba(255,255,255,0.4)", textFaint: "rgba(255,255,255,0.2)",
    accent: "#9FE1CB", accentBg: "rgba(159,225,203,0.08)", accentDark: "#0F6E56",
    red: "#F08080", redBg: "rgba(240,128,128,0.1)",
    input: { background: "rgba(255,255,255,0.05)", color: "#f0f0f0", border: "rgba(255,255,255,0.12)" },
  },
  light: {
    bg: "#f4f5f7", bgSecondary: "#ffffff", bgCard: "rgba(0,0,0,0.02)",
    border: "rgba(0,0,0,0.07)", borderStrong: "rgba(0,0,0,0.13)",
    text: "#111318", textMuted: "rgba(0,0,0,0.45)", textFaint: "rgba(0,0,0,0.25)",
    accent: "#0F6E56", accentBg: "rgba(15,110,86,0.07)", accentDark: "#0F6E56",
    red: "#c0392b", redBg: "rgba(192,57,43,0.08)",
    input: { background: "rgba(0,0,0,0.03)", color: "#111318", border: "rgba(0,0,0,0.12)" },
  }
};

// Indices pour le widget desktop
const INDICES = [
  { symbol: "^FCHI", label: "CAC 40" },
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^GDAXI", label: "DAX" },
];

function MarketWidget({ T }) {
  const [data, setData] = useState({});
  useEffect(() => {
    INDICES.forEach(async ({ symbol, label }) => {
      try {
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
        const d = await res.json();
        if (d.price) setData(prev => ({ ...prev, [label]: d }));
      } catch {}
    });
  }, []);

  return (
    <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>📈 Marchés</div>
      {INDICES.map(({ label }) => {
        const d = data[label];
        const change = d?.change;
        const color = change === undefined ? T.textFaint : change >= 0 ? T.accent : T.red;
        return (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `0.5px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>
              {d ? `${change >= 0 ? "+" : ""}${change?.toFixed(2)}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [themeKey, setThemeKey] = useState(() =>
    localStorage.getItem("verio-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 900);
  const [publicUserId, setPublicUserId] = useState(null);

  const T = themes[themeKey];

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth > 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  function toggleTheme() {
    const next = themeKey === "dark" ? "light" : "dark";
    setThemeKey(next);
    localStorage.setItem("verio-theme", next);
  }

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

  async function handleLogout() { await supabase.auth.signOut(); }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: "system-ui" }}>
      Chargement…
    </div>
  );

  if (!session && !showAuth) return <Landing onStart={() => setShowAuth(true)} />;
  if (!session && showAuth) return <Auth />;

  const kyc = profile && !profile.kyc_complete && !showKYC;
  const kycBanner = kyc ? (
    <div style={{ background: T.accentBg, borderBottom: `1px solid ${T.border}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 }}>
      <span>📋</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>Complète ton profil investisseur</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>Personnalise ton expérience en 2 minutes</div>
      </div>
      <button onClick={() => setShowKYC(true)} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
        Commencer →
      </button>
    </div>
  ) : null;

  const content = (
    <>
      {showKYC && <KYC session={session} profile={profile} onComplete={() => { setShowKYC(false); loadProfile(session.user.id); }} onSkip={() => setShowKYC(false)} />}
      {publicUserId ? (
        <ProfilPublic userId={publicUserId} session={session} T={T} onBack={() => setPublicUserId(null)} />
      ) : (
        <>
          {tab === "feed" && <Feed session={session} T={T} onViewProfile={setPublicUserId} />}
          {tab === "explore" && <Explore session={session} T={T} onViewProfile={setPublicUserId} />}
          {tab === "portfolio" && <Portfolio session={session} profile={profile} T={T} />}
          {tab === "profil" && <Profil profile={profile} session={session} T={T} onViewProfile={setPublicUserId} />}
        </>
      )}
    </>
  );

  // ── DESKTOP ──
  if (isDesktop) return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, background: T.bgSecondary, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "24px 14px", overflowY: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 28, paddingLeft: 8 }}>
          ve<span style={{ color: T.accent }}>rio</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", background: tab === t.id ? T.accentBg : "transparent", color: tab === t.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t.id ? 700 : 400, fontSize: 14 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
            <span>{themeKey === "dark" ? "☀️" : "🌙"}</span>
            {themeKey === "dark" ? "Mode clair" : "Mode sombre"}
          </button>
          {profile?.full_name && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {profile.full_name[0]}
              </div>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.full_name}</div>
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16 }} title="Déconnexion">↩</button>
            </div>
          )}
        </div>
      </div>

      {/* Centre */}
      <div style={{ marginLeft: 220, flex: 1, minWidth: 0, borderRight: `1px solid ${T.border}`, minHeight: "100vh" }}>
        {kycBanner}
        <div style={{ padding: "24px" }}>{content}</div>
      </div>

      {/* Droite */}
      <div style={{ width: 280, flexShrink: 0, padding: "24px 16px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 16, overflow: "visible" }}>
          <Notifications session={session} T={T} />
        </div>
        <MarketWidget T={T} />
      </div>
    </div>
  );

  // ── MOBILE ──
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: T.bgSecondary, borderBottom: `0.5px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>ve<span style={{ color: T.accent }}>rio</span></div>
            {profile?.full_name && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{getGreeting(profile.full_name)}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleTheme} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, cursor: "pointer" }}>
              {themeKey === "dark" ? "☀️" : "🌙"}
            </button>
            <Notifications session={session} T={T} />
            <button onClick={handleLogout} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Déco.</button>
          </div>
        </div>
      </div>
      {kycBanner}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>{content}</div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.bgSecondary, borderTop: `0.5px solid ${T.border}` }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "12px 4px 14px", fontSize: 10, background: "none", border: "none", color: tab === t.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t.id ? 600 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
