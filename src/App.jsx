import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "./supabase";
import { themes, getThemeKey } from "./theme";
import { clearFicheFromUrl } from "./useDetailView";
import { syncBadges } from "./badges";
import { syncMoments } from "./moments";
import { fetchUnreadTotal } from "./messages";
import Notifications from "./components/Notifications";
import Comparison from "./components/Comparison";
import Icon from "./components/Icon";
import { t } from "./i18n";

// Écrans chargés à la demande pour alléger le bundle initial
const Landing = lazy(() => import("./Landing"));
const Auth = lazy(() => import("./components/Auth"));
const Profil = lazy(() => import("./components/Profil"));
const Portfolio = lazy(() => import("./components/Portfolio"));
const Feed = lazy(() => import("./components/Feed"));
const Explore = lazy(() => import("./components/Explore"));
const KYC = lazy(() => import("./components/KYC"));
const Onboarding = lazy(() => import("./components/Onboarding"));
const ProfilPublic = lazy(() => import("./components/ProfilPublic"));
const Messages = lazy(() => import("./components/Messages"));
const ChatDock = lazy(() => import("./components/ChatDock"));
const ClubsWidget = lazy(() => import("./components/SideWidgets").then(m => ({ default: m.ClubsWidget })));
const InstallBanner = lazy(() => import("./components/InstallBanner"));
const FriendSuggestions = lazy(() => import("./components/SideWidgets").then(m => ({ default: m.FriendSuggestions })));

const TABS = [
  { id: "feed", label: "Fil", icon: "home" },
  { id: "explore", label: "Explore", icon: "search" },
  { id: "portfolio", label: "Portef.", icon: "chart" },
  { id: "profil", label: "Profil", icon: "user" },
];

// Onglet demandé par l'adresse (raccourcis de l'application installée : /?tab=portfolio)
const URL_TABS = ["feed", "explore", "portfolio", "profil", "messages"];
function tabFromUrl() {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return URL_TABS.includes(tab) ? tab : null;
  } catch {
    return null;
  }
}

// Ordinateur : l'interface grandit avec la largeur de la fenêtre, en pixels du navigateur
// (×1 jusqu'à 1 220 px, puis progressivement jusqu'à ×1,25 dès 1 525 px). Exemple : écran
// 1920 px avec Windows à 125 % = 1 536 px pour le navigateur → ×1,25, comme un zoom à 125 %.
const DESIGN_WIDTH = 1220;
function desktopZoom() {
  return Math.round(Math.min(1.25, Math.max(1, window.innerWidth / DESIGN_WIDTH)) * 100) / 100;
}

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  if (hour < 12) return t("Bonjour {name}", { name: firstName });
  if (hour < 18) return t("Bon après-midi {name}", { name: firstName });
  return t("Bonsoir {name}", { name: firstName });
}

// Bouton messagerie à côté de la cloche des notifications, avec le nombre de messages non lus
function MessagesButton({ unread, onClick, active, T }) {
  return (
    <button onClick={onClick} aria-label={unread > 0 ? t("Messagerie, {n} message(s) non lu(s)", { n: unread }) : t("Messagerie")}
      style={{ background: active ? T.accentBg : "none", border: `0.5px solid ${active ? T.accent : T.borderStrong}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", position: "relative", display: "flex", alignItems: "center" }}>
      <Icon name="comment" size={16} style={{ color: T.textMuted }} />
      {unread > 0 && (
        <span style={{ position: "absolute", top: -4, right: -4, background: T.red, color: T.bg, borderRadius: 999, minWidth: 16, height: 16, padding: "0 4px", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

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
      } catch {
        // indice indisponible : on garde "—"
      }
    });
  }, []);

  return (
    <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon name="up" size={14} />{t("Marchés")}</div>
      {INDICES.map(({ label }) => {
        const d = data[label];
        const change = d?.change;
        const color = change === undefined ? T.textFaint : change >= 0 ? T.up : T.red;
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



// Comparaison avec le profil public ouvert (colonne de droite, sur ordinateur)
function ComparisonWidget({ data, myId, T }) {
  if (!data) return null;
  return (
    <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Icon name="scale" size={13} />{t("Comparaison")}</div>
      <Comparison key={data.userId} myId={myId} theirEntries={data.entries} theirName={data.profile.full_name?.split(" ")[0]} T={T} />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // Sur ordinateur, la messagerie s'ouvre dans l'encart en bas d'écran, pas dans un onglet
  const [urlTab] = useState(tabFromUrl);
  const [tab, setTab] = useState(() => (urlTab === "messages" && window.innerWidth > 900 ? "feed" : urlTab || "feed"));
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [themeKey, setThemeKey] = useState(getThemeKey);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 900);
  const [zoom, setZoom] = useState(desktopZoom);
  const [publicUserId, setPublicUserId] = useState(null);
  const [compareData, setCompareData] = useState(null);
  // Incrémenté à chaque clic sur un onglet du menu : remet l'écran à son état de départ
  const [navKey, setNavKey] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageTarget, setMessageTarget] = useState(null);
  const clearMessageTarget = useCallback(() => setMessageTarget(null), []);
  const [dockOpen, setDockOpen] = useState(() => urlTab === "messages" && window.innerWidth > 900);
  // Écran d'Explore à ouvrir depuis la colonne de droite : { section, club }
  const [exploreIntent, setExploreIntent] = useState(null);
  const [dockTarget, setDockTarget] = useState(null);
  const clearDockTarget = useCallback(() => setDockTarget(null), []);

  const T = themes[themeKey];

  // Les éléments natifs du navigateur (listes déroulantes, barres de défilement) suivent le thème
  // ainsi que la barre du navigateur / de l'application installée et le fond visible au rebond du défilement
  useEffect(() => {
    document.documentElement.style.colorScheme = themeKey;
    document.body.style.background = themes[themeKey].bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes[themeKey].bgSecondary);
  }, [themeKey]);

  // Agrandissement sur ordinateur, une fois connecté (--verio-zoom corrige les hauteurs en vh, agrandies elles aussi)
  const scaled = !!session && isDesktop && zoom > 1;
  useEffect(() => {
    const root = document.documentElement;
    root.style.zoom = scaled ? String(zoom) : "";
    root.style.setProperty("--verio-zoom", scaled ? String(zoom) : "1");
  }, [scaled, zoom]);

  // Un clic sur un #hashtag (n'importe où) ouvre Explore sur ce hashtag
  useEffect(() => {
    const onHashtag = e => {
      clearFicheFromUrl();
      setTab("explore");
      setExploreIntent({ hashtag: e.detail });
      setNavKey(k => k + 1);
      setPublicUserId(null);
      setCompareData(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("verio:hashtag", onHashtag);
    return () => window.removeEventListener("verio:hashtag", onHashtag);
  }, []);

  // L'onglet ouvert est gardé dans l'adresse (?tab=explore) : actualiser la page y reste.
  // Le fil n'a pas de paramètre ; « source=pwa » (lancement depuis l'icône) est retiré.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("source");
    if (URL_TABS.includes(tab) && tab !== "feed") params.set("tab", tab); else params.delete("tab");
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, "", next);
  }, [tab]);

  useEffect(() => {
    const handler = () => { setIsDesktop(window.innerWidth > 900); setZoom(desktopZoom()); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Messages non lus : au chargement puis toutes les 30 s
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    const refresh = () => fetchUnreadTotal().then(n => { if (!ignore) setUnreadMessages(n); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { ignore = true; clearInterval(timer); };
  }, [userId]);

  // « Message » depuis un profil : ouvre la conversation dans l'onglet Messages
  // Ordinateur : fenêtre de discussion en bas d'écran ; mobile : messagerie plein écran
  function openMessage(otherId) {
    if (isDesktop) { setDockTarget(otherId); setDockOpen(true); return; }
    setMessageTarget(otherId);
    goToTab("messages");
  }

  function toggleTheme() {
    const next = themeKey === "dark" ? "light" : "dark";
    setThemeKey(next);
    localStorage.setItem("verio-theme", next);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile();
      else { setProfile(null); setLoading(false); setShowAuth(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() {
    // Badges et moments liés au temps (ancienneté, série, anniversaires) : dès la connexion
    syncBadges();
    syncMoments();
    const { data } = await supabase.rpc("get_my_profile").maybeSingle();
    setProfile(data);
    setLoading(false);
  }

  // Changer d'onglet ferme aussi le profil public éventuellement ouvert
  // « target » : écran à ouvrir dans l'onglet — Explore : { section, club, clubView, hashtag } ;
  // Profil : { section } ; « post » : { activityId }
  function goToTab(id, target = null) {
    clearFicheFromUrl();
    setTab(id);
    setExploreIntent(target);
    setNavKey(k => k + 1);
    window.scrollTo(0, 0);
    setPublicUserId(null);
    setCompareData(null);
  }

  // Clic sur une notification : ouvre ce dont elle parle
  async function openNotification(n) {
    const d = n.data || {};
    const openClub = async clubId => {
      const { data: club } = await supabase.from("clubs").select("*").eq("id", clubId).single();
      if (club) goToTab("explore", { section: "clubs", club });
    };
    if (n.type === "mention" && d.club_id) return openClub(d.club_id);
    if (["activity_like", "activity_comment", "mention", "poll_ended", "super_filing"].includes(n.type) && d.activity_id != null) return goToTab("post", { activityId: d.activity_id });
    if (n.type === "post_reaction" && d.post_id != null) {
      const { data: post } = await supabase.from("club_posts").select("club_id").eq("id", d.post_id).single();
      if (post) return openClub(post.club_id);
    }
    if (n.type === "friend_request") return goToTab("profil", { section: "reseau" });
    if (n.type === "friend_accepted" && d.from_id) return viewProfile(d.from_id);
    if (n.type === "badge_unlocked") return goToTab("profil", { section: "badges" });
    if (n.type === "moment") return goToTab("feed");
  }

  // Ouvre le profil d'un membre ; son propre nom mène à l'onglet Profil
  function viewProfile(userId) {
    if (userId === session?.user.id) goToTab("profil");
    else { setPublicUserId(userId); setCompareData(null); }
    window.scrollTo(0, 0);
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  const loadingScreen = (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {t("Chargement…")}
    </div>
  );

  if (loading) return loadingScreen;

  if (!session) return (
    <Suspense fallback={loadingScreen}>
      {showAuth ? <Auth T={T} /> : <Landing onStart={() => setShowAuth(true)} />}
    </Suspense>
  );

  const kyc = profile && !profile.kyc_complete && !showKYC;
  const kycBanner = kyc ? (
    <div style={{ background: T.accentBg, borderBottom: `1px solid ${T.border}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 }}>
      <Icon name="list" size={18} style={{ color: T.accent }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{t("Complète ton profil investisseur")}</div>
        <div style={{ fontSize: 12, color: T.textMuted }}>{t("Personnalise ton expérience en 2 minutes")}</div>
      </div>
      <button onClick={() => setShowKYC(true)} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>
        {t("Commencer →")}
      </button>
    </div>
  ) : null;

  const content = (
    <Suspense fallback={<div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", padding: "2rem" }}>{t("Chargement…")}</div>}>
      {showKYC && <KYC session={session} profile={profile} T={T} onComplete={() => { setShowKYC(false); setShowOnboarding(true); loadProfile(); }} onSkip={() => setShowKYC(false)} />}
      {/* Après le questionnaire : premiers comptes, sociétés et indices à suivre */}
      {showOnboarding && <Onboarding session={session} T={T} onDone={() => { setShowOnboarding(false); setNavKey(k => k + 1); }} />}
      {publicUserId ? (
        <ProfilPublic key={publicUserId} userId={publicUserId} session={session} T={T} onMessage={openMessage} onViewProfile={viewProfile} onBack={() => { setPublicUserId(null); setCompareData(null); }} onCompareData={setCompareData} />
      ) : (
        <>
          {tab === "feed" && <Feed key={navKey} session={session} T={T} onViewProfile={viewProfile} onOpenClub={club => goToTab("explore", { section: "clubs", club })} />}
          {tab === "explore" && <Explore key={navKey} session={session} T={T} onViewProfile={viewProfile} initialSection={exploreIntent?.section} initialClub={exploreIntent?.club} initialClubView={exploreIntent?.clubView} initialHashtag={exploreIntent?.hashtag} />}
          {tab === "portfolio" && <Portfolio key={navKey} session={session} T={T} onViewPublic={() => { setPublicUserId(session.user.id); setCompareData(null); window.scrollTo(0, 0); }} />}
          {tab === "messages" && <Messages key={navKey} session={session} T={T} openWith={messageTarget} onOpened={clearMessageTarget} onViewProfile={viewProfile} onUnreadChange={setUnreadMessages} />}
          {tab === "profil" && <Profil key={navKey} profile={profile} session={session} T={T} onViewProfile={viewProfile} initialSection={exploreIntent?.section || "stats"} />}
          {/* Un post ouvert depuis une notification, commentaires ouverts */}
          {tab === "post" && exploreIntent?.activityId != null && (
            <div>
              <button onClick={() => goToTab("feed")} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>← {t("Fil")}</button>
              <Feed key={`post-${exploreIntent.activityId}-${navKey}`} session={session} T={T} focusId={exploreIntent.activityId} onViewProfile={viewProfile} onOpenClub={club => goToTab("explore", { section: "clubs", club })} />
            </div>
          )}
        </>
      )}
    </Suspense>
  );

  // ── DESKTOP ──
  if (isDesktop) return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, background: T.bgSecondary, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "24px 14px", overflowY: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 28, paddingLeft: 8 }}>
          ve<span style={{ color: T.accent }}>rio</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => goToTab(tb.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", background: tab === tb.id ? T.accentBg : "transparent", color: tab === tb.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === tb.id ? 700 : 400, fontSize: 14 }}>
              <Icon name={tb.icon} size={18} />{t(tb.label)}
            </button>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
            <Icon name={themeKey === "dark" ? "sun" : "moon"} size={16} />
            {themeKey === "dark" ? t("Mode clair") : t("Mode sombre")}
          </button>
          {profile?.full_name && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {profile.full_name[0]}
              </div>
              <button onClick={() => goToTab("profil")} title={t("Mon profil")} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.full_name}</button>
              <button onClick={handleLogout} aria-label={t("Déconnexion")} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center" }} title={t("Déconnexion")}><Icon name="logout" size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Centre */}
      <div style={{ marginLeft: 220, flex: 1, minWidth: 0, borderRight: `1px solid ${T.border}`, minHeight: "100vh" }}>
        {kycBanner}
        <div style={{ padding: "24px" }}>{content}</div>
      </div>

      <Suspense fallback={null}>
        <ChatDock session={session} T={T} open={dockOpen} onToggle={() => setDockOpen(o => !o)}
          target={dockTarget} onTargetHandled={clearDockTarget} onViewProfile={viewProfile} onUnreadChange={setUnreadMessages} />
      </Suspense>

      {/* Droite */}
      <div style={{ width: 280, flexShrink: 0, padding: "24px 16px 72px", position: "sticky", top: 0, height: "calc(100vh / var(--verio-zoom, 1))", overflowY: "auto" }}>
        {publicUserId ? (
          <ComparisonWidget data={compareData} myId={session?.user.id} T={T} />
        ) : (
          <>
            <div style={{ background: T.bgSecondary, border: `1px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: 16, marginBottom: 16, position: "relative", zIndex: 50 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Notifications session={session} T={T} onOpen={openNotification} />
                <MessagesButton unread={unreadMessages} active={dockOpen} onClick={() => setDockOpen(o => !o)} T={T} />
              </div>
            </div>
            <MarketWidget T={T} />
            <Suspense fallback={null}>
              <ClubsWidget session={session} T={T}
                onOpenClub={club => goToTab("explore", { section: "clubs", club })}
                onAllClubs={mine => goToTab("explore", { section: "clubs", clubView: mine ? "mes" : "decouvrir" })} />
              <FriendSuggestions session={session} T={T} onViewProfile={viewProfile}
                onFindFriends={() => goToTab("explore", { section: "amis" })} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );

  // ── MOBILE ──
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div style={{ background: T.bgSecondary, borderBottom: `0.5px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10, paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>ve<span style={{ color: T.accent }}>rio</span></div>
            {profile?.full_name && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{getGreeting(profile.full_name)}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleTheme} aria-label={themeKey === "dark" ? t("Passer en mode clair") : t("Passer en mode sombre")} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", color: T.textMuted }}>
              <Icon name={themeKey === "dark" ? "sun" : "moon"} size={16} />
            </button>
            <Notifications session={session} T={T} onOpen={openNotification} />
            <MessagesButton unread={unreadMessages} active={tab === "messages"} onClick={() => goToTab("messages")} T={T} />
            <button onClick={handleLogout} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("Déco.")}</button>
          </div>
        </div>
      </div>
      {kycBanner}
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "1.5rem 1rem calc(6rem + env(safe-area-inset-bottom))" }}>
        {tab === "feed" && !publicUserId && <Suspense fallback={null}><InstallBanner T={T} /></Suspense>}
        {content}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.bgSecondary, borderTop: `0.5px solid ${T.border}`, paddingBottom: "env(safe-area-inset-bottom)", zIndex: 10 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex" }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => goToTab(tb.id)} style={{ flex: 1, padding: "12px 4px 14px", fontSize: 10, background: "none", border: "none", color: tab === tb.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === tb.id ? 600 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Icon name={tb.icon} size={20} />{t(tb.label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
