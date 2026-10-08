import { useState, useEffect } from "react";
import Marches from "./Marches";
import Clubs from "./Clubs";
import IndexDetail from "./IndexDetail";
import SuperInvestors from "./SuperInvestors";
import { searchAssets } from "../attachments";
import { detailFor } from "../indices";
import Feed from "./Feed";
import { useDetailView } from "../useDetailView";
import { supabase } from "../supabase";
import { syncBadges } from "../badges";
import { T as TLive } from "../theme";
import Avatar from "./Avatar";

const card = (T) => ({ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 });
const inp = (T) => ({ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 10, border: `0.5px solid ${T.borderStrong}`, background: T.bgCard, color: T.text, fontFamily: "inherit", display: "block" });
const btnSm = (T) => ({ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" });



const CATEGORIES = {
  "📈 Actions": ["Actions France","Actions Europe","Actions USA","Actions Monde","Actions Émergents","Small Caps","Value Investing","Growth Investing","Dividendes","Stock Picking"],
  "📊 ETF": ["ETF Monde (MSCI World)","ETF S&P 500","ETF Europe","ETF Émergents","ETF Thématiques","ETF Dividendes","ETF Obligataires","ETF Immobilier (REIT)"],
  "🏦 Fonds": ["Fonds Actifs","Fonds Mixtes","Private Equity","Hedge Funds"],
  "📉 Obligations": ["Obligations État","Obligations Entreprises","Obligations Émergentes","High Yield"],
  "🏠 Immobilier": ["SCPI","REIT / SIIC","Immobilier Direct","Crowdfunding Immo"],
  "💰 Patrimoine & Stratégie": ["DCA Long Terme","PEA","Assurance Vie","Retraite / PER","Fiscalité","Débutants"],
  "₿ Crypto": ["Bitcoin","Altcoins","DeFi","NFT & Web3"],
};

// Amis, demandes en attente, mes clubs et tous les clubs avec leur nombre de membres
async function fetchExploreContext(userId) {
  const { data: f } = await supabase.from("friendships").select("requester_id, receiver_id, status").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  const friendIds = [], pendingIds = [];
  if (f) f.forEach(fr => {
    const otherId = fr.requester_id === userId ? fr.receiver_id : fr.requester_id;
    if (fr.status === "accepted") friendIds.push(otherId);
    else pendingIds.push(otherId);
  });

  const { data: m } = await supabase.from("club_members").select("club_id").eq("user_id", userId);
  const { data: c } = await supabase.from("clubs").select("*").order("created_at", { ascending: false });
  const counts = {};
  for (const club of c || []) {
    const { count } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", club.id);
    counts[club.id] = count || 0;
  }
  const myClubIds = (m || []).map(x => x.club_id);

  // Dernier message de chacun de mes clubs (espace « Mes clubs »)
  const lastPosts = {};
  if (myClubIds.length) {
    const { data: posts } = await supabase.from("club_posts")
      .select("club_id, content, created_at, author:profiles!club_posts_user_id_fkey(full_name)")
      .in("club_id", myClubIds).order("created_at", { ascending: false }).limit(200);
    for (const post of posts || []) if (!lastPosts[post.club_id]) lastPosts[post.club_id] = post;
  }
  // Super Investors : on les suit depuis leur profil (pas de demande d'ami)
  const { data: supers } = await supabase.from("super_investors").select("user_id, icon");
  return { friendIds, pendingIds, myClubIds, clubs: c || [], counts, lastPosts, superIcons: Object.fromEntries((supers || []).map(x => [x.user_id, x.icon])) };
}

// Fiche d'une valeur ouverte depuis la recherche : gardée dans l'adresse (symbole, nom, type)
const RECHERCHE_URL = { urlKey: "recherche", toUrl: a => ({ symbol: a.symbol, name: a.name, type: a.type }) };

async function searchExplore(query, searchTab, userId) {
  if (searchTab === "assets") return searchAssets(query.trim());
  // Retire les caractères qui ont un sens dans la syntaxe de filtre PostgREST
  const q = query.replace(/[,()%*\\]/g, " ").trim();
  if (!q) return [];
  if (searchTab === "users") {
    const { data } = await supabase.from("profiles").select("id, full_name, username, city, strategy, streak_mois").or(`full_name.ilike.%${q}%,username.ilike.%${q}%`).neq("id", userId).limit(10);
    return data || [];
  }
  const { data } = await supabase.from("clubs").select("*").ilike("name", `%${q}%`).limit(10);
  return data || [];
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 3600) return `il y a ${Math.max(1, Math.floor(diff / 60))} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function Explore({ session , T: TProp, onViewProfile, initialSection, initialClub = null, initialClubView = null, initialHashtag = null }) {
  const T = TProp || TLive;
  const [query, setQuery] = useState("");
  const [searchTab, setSearchTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [openAsset, showAsset, closeAsset] = useDetailView(RECHERCHE_URL); // fiche d'une valeur trouvée par la recherche
  const [hashtag, setHashtag] = useState(initialHashtag); // page d'un hashtag (clic sur #… dans un post)
  const [allClubs, setAllClubs] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [friendIds, setFriendIds] = useState([]);
  const [pendingIds, setPendingIds] = useState([]);
  const [myClubIds, setMyClubIds] = useState([]);
  const [lastPosts, setLastPosts] = useState({});
  const [contextLoaded, setContextLoaded] = useState(false);
  const [superIcons, setSuperIcons] = useState({}); // user_id → icône des Super Investors
  // « mes » ou « decouvrir » ; null = choix automatique (mes clubs si j'en ai)
  const [clubView, setClubView] = useState(initialClubView);
  const [loading, setLoading] = useState(false);
  const [selectedClub, setSelectedClub] = useState(initialClub);
  // « amis » : pas une section, on ouvre Explore sur la recherche de membres
  // Un portefeuille de Super Investor gardé dans l'adresse rouvre cette section
  const [section, setSection] = useState(() => (initialSection === "clubs" || initialSection === "super" ? initialSection
    : (new URLSearchParams(window.location.search).get("fiche") || "").startsWith("super:") ? "super" : "marches"));
  const [filterCat, setFilterCat] = useState("Tous");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "", subcategory: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const myId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchExploreContext(myId).then(ctx => {
      if (ignore) return;
      setFriendIds(ctx.friendIds);
      setPendingIds(ctx.pendingIds);
      setMyClubIds(ctx.myClubIds);
      setAllClubs(ctx.clubs);
      setMemberCounts(ctx.counts);
      setLastPosts(ctx.lastPosts);
      setSuperIcons(ctx.superIcons);
      setContextLoaded(true);
    });
    return () => { ignore = true; };
  }, [myId, reloadKey]);

  // Recherche avec un délai de 300 ms ; sous 2 caractères les résultats ne sont pas affichés
  useEffect(() => {
    if (query.length < 2) return;
    let ignore = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const results = await searchExplore(query, searchTab, myId);
      if (ignore) return;
      if (searchTab === "users") setUsers(results);
      else if (searchTab === "assets") setAssets(results);
      else setClubs(results);
      setLoading(false);
    }, 300);
    return () => { ignore = true; clearTimeout(t); };
  }, [query, searchTab, myId]);

  async function sendRequest(userId) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: userId, status: "pending" });
    await supabase.from("notifications").insert({ user_id: userId, type: "friend_request", data: { from_name: me?.full_name, from_id: session.user.id } });
    setPendingIds(p => [...p, userId]);
  }

  async function joinClub(clubId) {
    await supabase.from("club_members").insert({ club_id: clubId, user_id: session.user.id });
    syncBadges();
    setMyClubIds(p => [...p, clubId]);
    setMemberCounts(p => ({ ...p, [clubId]: (p[clubId] || 0) + 1 }));
  }

  async function createClub() {
    setError("");
    if (!form.name.trim()) return setError("Donne un nom au club.");
    if (!form.category) return setError("Choisis une catégorie.");
    if (!form.subcategory) return setError("Choisis une sous-catégorie.");
    setSaving(true);
    const { data, error: err } = await supabase.from("clubs").insert({ name: form.name.trim(), description: form.description.trim(), category: form.category, subcategory: form.subcategory, creator_id: session.user.id }).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("club_members").insert({ club_id: data.id, user_id: session.user.id });
    syncBadges();
    setForm({ name: "", description: "", category: "", subcategory: "" });
    setShowForm(false);
    setReloadKey(k => k + 1);
    setSaving(false);
  }

  const filteredClubs = filterCat === "Tous" ? allClubs : allClubs.filter(c => c.category === filterCat);
  const myClubs = allClubs.filter(c => myClubIds.includes(c.id))
    .sort((a, b) => new Date(lastPosts[b.id]?.created_at || 0) - new Date(lastPosts[a.id]?.created_at || 0));
  const activeClubView = clubView || (contextLoaded && myClubIds.length === 0 ? "decouvrir" : "mes");

  // « #div… » tapé dans la recherche : les posts de ce hashtag
  const typedTag = /^#([\p{L}\p{N}_]{2,30})$/u.exec(query.trim())?.[1]?.toLowerCase() || null;
  const tagTitle = tag => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>#{tag}</div>
      <div style={{ fontSize: 12, color: T.textFaint }}>Posts de Verio et de tes clubs</div>
    </div>
  );

  if (hashtag) {
    return (
      <div>
        <button onClick={() => setHashtag(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>← Explore</button>
        {tagTitle(hashtag)}
        <Feed key={hashtag} session={session} T={T} hashtag={hashtag} onViewProfile={onViewProfile} onOpenClub={club => setSelectedClub(club)} />
      </div>
    );
  }
  if (openAsset) return <IndexDetail index={detailFor(openAsset)} T={T} backLabel="← Recherche" onBack={closeAsset} />;
  if (selectedClub) return <Clubs session={session} T={T} initialClub={selectedClub} onBack={() => setSelectedClub(null)} onViewProfile={onViewProfile} />;

  return (
    <div>
      {/* Barre de recherche */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <input style={{ ...inp(T), paddingLeft: 40 }} placeholder="Rechercher un investisseur, un club, une valeur, un #hashtag…" autoFocus={initialSection === "amis"} value={query} onChange={e => setQuery(e.target.value)} />
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: T.textFaint }}>🔍</span>
        {query && <button onClick={() => setQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 14 }}>✕</button>}
      </div>

      {/* Résultats de recherche */}
      {typedTag ? (
        <div>
          {tagTitle(typedTag)}
          <Feed key={typedTag} session={session} T={T} hashtag={typedTag} onViewProfile={onViewProfile} onOpenClub={club => setSelectedClub(club)} />
        </div>
      ) : query.length >= 2 ? (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[["users", "👤 Investisseurs"], ["clubs", "🏛️ Clubs"], ["assets", "📈 Valeurs"]].map(([id, label]) => (
              <button key={id} onClick={() => setSearchTab(id)} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${searchTab === id ? T.accent : T.border}`, background: searchTab === id ? T.accentBg : "none", color: searchTab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
                {label}
              </button>
            ))}
          </div>

          {loading && <div style={{ fontSize: 13, color: T.textFaint, padding: "1rem 0" }}>Recherche…</div>}

          {!loading && searchTab === "users" && users.map(u => (
            <div key={u.id} onClick={() => onViewProfile && onViewProfile(u.id)} style={{ ...card(T), display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              {superIcons[u.id]
                ? <div style={{ width: 40, height: 40, borderRadius: 12, background: T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{superIcons[u.id]}</div>
                : <Avatar userId={u.id} name={u.full_name} size={40} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{u.full_name}{superIcons[u.id] && <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: "rgba(240,215,0,0.1)", color: T.gold }}>🏆 Légende</span>}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>@{u.username}{u.city ? ` · ${u.city}` : ""}{u.strategy ? ` · ${u.strategy}` : ""}</div>
                {u.streak_mois > 0 && <div style={{ fontSize: 11, color: T.yellow, marginTop: 2 }}>🔥 {u.streak_mois} mois</div>}
              </div>
              {superIcons[u.id] ? null
                : friendIds.includes(u.id) ? <span style={{ fontSize: 12, color: T.accent }}>✓ Ami</span>
                : pendingIds.includes(u.id) ? <span style={{ fontSize: 12, color: T.textFaint }}>En attente</span>
                : <button onClick={e => { e.stopPropagation(); sendRequest(u.id); }} style={{ ...btnSm(T), borderColor: T.accent, color: T.accent }}>+ Suivre</button>}
            </div>
          ))}

          {!loading && searchTab === "assets" && assets.map(a => (
            <div key={a.symbol} role="button" tabIndex={0} onClick={() => showAsset(a)}
              onKeyDown={e => e.key === "Enter" && showAsset(a)}
              style={{ ...card(T), display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{a.symbol.replace(/^\^/, "").split(".")[0].slice(0, 5)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{a.symbol} · {a.type}{a.exchange ? ` · ${a.exchange}` : ""}</div>
              </div>
            </div>
          ))}

          {!loading && searchTab === "clubs" && clubs.map(club => (
            <div key={club.id} onClick={() => setSelectedClub(club)} style={{ ...card(T), display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{club.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{club.subcategory}</div>
              </div>
              {myClubIds.includes(club.id) ? <span style={{ fontSize: 12, color: T.accent }}>✓ Membre</span>
                : <button onClick={e => { e.stopPropagation(); joinClub(club.id); }} style={{ ...btnSm(T), borderColor: T.accent, color: T.accent }}>Rejoindre</button>}
            </div>
          ))}

          {!loading && searchTab === "users" && users.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>Aucun investisseur trouvé</div>}
          {!loading && searchTab === "clubs" && clubs.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>Aucun club trouvé</div>}
          {!loading && searchTab === "assets" && assets.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>Aucune valeur trouvée (nom, ticker ou ISIN)</div>}
        </div>
      ) : (
        <>
          {/* Onglets Marchés / Clubs / Super Investors */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[["marches", "🌍 Marchés"], ["clubs", "🏛️ Clubs"], ["super", "🏆 Légendes"]].map(([id, label]) => (
              <button key={id} onClick={() => { setSection(id); setFilterCat('Tous'); }} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${section === id ? T.accent : T.border}`, background: section === id ? T.accentBg : "none", color: section === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Marchés */}
          {section === "marches" && <Marches T={T} />}

          {/* Clubs */}
          {section === "clubs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ display: "flex", gap: 4, background: T.bgSubtle, borderRadius: 10, padding: 3 }}>
                  {[["mes", `Mes clubs${contextLoaded ? ` (${myClubIds.length})` : ""}`], ["decouvrir", "Découvrir"]].map(([id, label]) => (
                    <button key={id} onClick={() => setClubView(id)} aria-pressed={activeClubView === id}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: activeClubView === id ? 700 : 500, border: "none", background: activeClubView === id ? T.bgCard : "transparent", color: activeClubView === id ? T.text : T.textMuted, boxShadow: activeClubView === id ? T.cardShadow : "none", cursor: "pointer", fontFamily: "inherit" }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {showForm ? "Annuler" : "+ Créer"}
                </button>
              </div>

              {activeClubView === "decouvrir" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["Tous","Tous"],["📈 Actions","Actions"],["📊 ETF","ETF"],["🏦 Fonds","Fonds"],["📉 Obligations","Oblig."],["🏠 Immobilier","Immo"],["💰 Patrimoine & Stratégie","Stratégie"],["₿ Crypto","Crypto"]].map(([key,label]) => (
                    <button key={key} onClick={() => setFilterCat(key)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filterCat === key ? T.accent : T.border}`, background: filterCat === key ? T.accentBg : "none", color: filterCat === key ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {showForm && (
                <div style={{ ...card(T), marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Créer un club</div>
                  <input style={{ ...inp(T), marginBottom: 10 }} placeholder="Nom du club" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <textarea style={{ ...inp(T), height: 60, resize: "none", marginBottom: 10 }} placeholder="Description (optionnel)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.keys(CATEGORIES).map(cat => (
                      <button key={cat} onClick={() => setForm({ ...form, category: cat, subcategory: "" })} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${form.category === cat ? T.accent : T.border}`, background: form.category === cat ? T.accentBg : "none", color: form.category === cat ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{cat}</button>
                    ))}
                  </div>
                  {form.category && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {CATEGORIES[form.category].map(sub => (
                        <button key={sub} onClick={() => setForm({ ...form, subcategory: sub })} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${form.subcategory === sub ? T.accent : T.border}`, background: form.subcategory === sub ? T.accentBg : "none", color: form.subcategory === sub ? T.accent : T.textFaint, cursor: "pointer", fontFamily: "inherit" }}>{sub}</button>
                      ))}
                    </div>
                  )}
                  {error && <div style={{ fontSize: 13, color: T.red, marginBottom: 8 }}>⚠️ {error}</div>}
                  <button onClick={createClub} disabled={saving} style={{ background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>{saving ? "Création…" : "Créer"}</button>
                </div>
              )}

              {activeClubView === "mes" && !showForm && (
                <>
                  {contextLoaded && myClubs.length === 0 && (
                    <div style={{ ...card(T), textAlign: "center", padding: "2rem 1rem" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>Tu n'as rejoint aucun club</div>
                      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>Échange avec des investisseurs qui partagent ta stratégie.</div>
                      <button onClick={() => setClubView("decouvrir")} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>Découvrir les clubs</button>
                    </div>
                  )}
                  {myClubs.map(club => {
                    const last = lastPosts[club.id];
                    const n = memberCounts[club.id] || 0;
                    return (
                      <div key={club.id} onClick={() => setSelectedClub(club)} style={{ ...card(T), cursor: "pointer", padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{(club.category || "👥").split(" ")[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{club.name}</span>
                              <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>👥 {n} membre{n > 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {last
                                ? <>💬 <b style={{ fontWeight: 600 }}>{last.author?.full_name?.split(" ")[0] || "Un membre"}</b> : {last.content} <span style={{ color: T.textFaint }}>· {timeAgo(last.created_at)}</span></>
                                : <span style={{ color: T.textFaint }}>Pas encore de discussion — lance la première !</span>}
                            </div>
                          </div>
                          <span style={{ color: T.textFaint, fontSize: 16 }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {activeClubView === "decouvrir" && filteredClubs.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem 0" }}>Aucun club — crée le premier ! 🚀</div>}

              {activeClubView === "decouvrir" && filteredClubs.map(club => (
                <div key={club.id} onClick={() => setSelectedClub(club)} style={{ ...card(T), cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{club.name}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>{club.subcategory}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.bgSubtle, color: T.textMuted }}>👥 {memberCounts[club.id] || 0} membre{(memberCounts[club.id] || 0) > 1 ? "s" : ""}</span>
                        {myClubIds.includes(club.id) && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>✓ Membre</span>}
                      </div>
                      {club.description && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{club.description}</div>}
                    </div>
                    {!myClubIds.includes(club.id) && (
                      <button onClick={() => joinClub(club.id)} style={{ ...btnSm(T), borderColor: T.accent, color: T.accent, flexShrink: 0 }}>+ Rejoindre</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Super Investors */}
          {section === "super" && <SuperInvestors T={T} onViewProfile={onViewProfile} />}
        </>
      )}
    </div>
  );
}
