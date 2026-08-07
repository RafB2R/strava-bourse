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

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showKYC, setShowKYC] = useState(false);

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
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "system-ui" }}>
      Chargement…
    </div>
  );

  if (!session && !showAuth) return <Landing onStart={() => setShowAuth(true)} />;
  if (!session && showAuth) return <Auth />;

  return (
    <div style={{ background: "#111318", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111318", borderBottom: "0.5px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>ve<span style={{ color: "#9FE1CB" }}>rio</span></div>
            {profile?.full_name && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                {getGreeting(profile.full_name)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Notifications session={session} />
            <button onClick={handleLogout} style={{ background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Bannière KYC */}
      {profile && !profile.kyc_complete && !showKYC && (
        <div style={{ background: "rgba(159,225,203,0.08)", borderBottom: "0.5px solid rgba(159,225,203,0.2)" }}>
          <div style={{ maxWidth: 620, margin: "0 auto", padding: "10px 1rem", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9FE1CB" }}>Complète ton profil investisseur</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Personnalise ton expérience en 2 minutes</div>
            </div>
            <button onClick={() => setShowKYC(true)} style={{ background: "#9FE1CB", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Commencer →
            </button>
          </div>
        </div>
      )}

      {showKYC && (
        <KYC
          session={session}
          profile={profile}
          onComplete={() => { setShowKYC(false); loadProfile(session.user.id); }}
          onSkip={() => setShowKYC(false)}
        />
      )}

      {/* Contenu */}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>
        {tab === "feed" && <Feed session={session} />}
        {tab === "explore" && <Explore session={session} />}
        {tab === "portfolio" && <Portfolio session={session} profile={profile} />}
        {tab === "profil" && <Profil profile={profile} session={session} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111318", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "12px 4px 14px", fontSize: 10, background: "none", border: "none",
              color: tab === t.id ? "#9FE1CB" : "rgba(255,255,255,0.3)",
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
