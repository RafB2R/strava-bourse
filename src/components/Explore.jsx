import { useState, useEffect } from "react";
import ProfilPublic from "./ProfilPublic";
import Marches from "./Marches";
import Clubs from "./Clubs";
import { supabase } from "../supabase";

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const inp = { width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", display: "block" };
const btnSm = { background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB","rgba(240,153,123,0.12)|#F0997B","rgba(175,169,236,0.12)|#AFA9EC","rgba(123,184,240,0.12)|#7BB8F0"];
function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size*0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

const SUPER_INVESTORS = [
  { name: "Warren Buffett", handle: "berkshire", desc: "Value investing légendaire — 44 positions", perf: "+19.8% / an depuis 1965", icon: "🦁" },
  { name: "Bill Ackman", handle: "pershing", desc: "Activiste concentré — 8 positions", perf: "+16.2% / an depuis 2004", icon: "🎯" },
  { name: "Stanley Druckenmiller", handle: "duquesne", desc: "Macro global — trading quantitatif", perf: "+30% / an sur 30 ans", icon: "🌍" },
  { name: "Michael Burry", handle: "scion", desc: "Contrarian — célèbre pour le Big Short", perf: "Gestion indépendante", icon: "🔍" },
];

const CATEGORIES = {
  "📈 Actions": ["Actions France","Actions Europe","Actions USA","Actions Monde","Actions Émergents","Small Caps","Value Investing","Growth Investing","Dividendes","Stock Picking"],
  "📊 ETF": ["ETF Monde (MSCI World)","ETF S&P 500","ETF Europe","ETF Émergents","ETF Thématiques","ETF Dividendes","ETF Obligataires","ETF Immobilier (REIT)"],
  "🏦 Fonds": ["Fonds Actifs","Fonds Mixtes","Private Equity","Hedge Funds"],
  "📉 Obligations": ["Obligations État","Obligations Entreprises","Obligations Émergentes","High Yield"],
  "🏠 Immobilier": ["SCPI","REIT / SIIC","Immobilier Direct","Crowdfunding Immo"],
  "💰 Patrimoine & Stratégie": ["DCA Long Terme","PEA","Assurance Vie","Retraite / PER","Fiscalité","Débutants"],
  "₿ Crypto": ["Bitcoin","Altcoins","DeFi","NFT & Web3"],
};

export default function Explore({ session }) {
  const [query, setQuery] = useState("");
  const [searchTab, setSearchTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [friendIds, setFriendIds] = useState([]);
  const [pendingIds, setPendingIds] = useState([]);
  const [myClubIds, setMyClubIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedClub, setSelectedClub] = useState(null);
  const [section, setSection] = useState("marches");
  const [filterCat, setFilterCat] = useState("Tous");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "", subcategory: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadContext(); }, []);

  async function loadContext() {
    const { data: f } = await supabase.from("friendships").select("requester_id, receiver_id, status").or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
    const fIds = [], pIds = [];
    if (f) f.forEach(fr => {
      const otherId = fr.requester_id === session.user.id ? fr.receiver_id : fr.requester_id;
      if (fr.status === "accepted") fIds.push(otherId);
      else pIds.push(otherId);
    });
    setFriendIds(fIds);
    setPendingIds(pIds);

    const { data: m } = await supabase.from("club_members").select("club_id").eq("user_id", session.user.id);
    setMyClubIds((m || []).map(x => x.club_id));

    const { data: c } = await supabase.from("clubs").select("*").order("created_at", { ascending: false });
    setAllClubs(c || []);
    if (c) {
      const counts = {};
      for (const club of c) {
        const { count } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", club.id);
        counts[club.id] = count || 0;
      }
      setMemberCounts(counts);
    }
  }

  useEffect(() => {
    if (query.length < 2) { setUsers([]); setClubs([]); return; }
    const t = setTimeout(() => search(), 300);
    return () => clearTimeout(t);
  }, [query, searchTab]);

  async function search() {
    setLoading(true);
    if (searchTab === "users") {
      const { data } = await supabase.from("profiles").select("id, full_name, username, city, strategy, streak_mois").or(`full_name.ilike.%${query}%,username.ilike.%${query}%`).neq("id", session.user.id).limit(10);
      setUsers(data || []);
    } else {
      const { data } = await supabase.from("clubs").select("*").ilike("name", `%${query}%`).limit(10);
      setClubs(data || []);
    }
    setLoading(false);
  }

  async function sendRequest(userId) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: userId, status: "pending" });
    await supabase.from("notifications").insert({ user_id: userId, type: "friend_request", data: { from_name: me?.full_name, from_id: session.user.id } });
    setPendingIds(p => [...p, userId]);
  }

  async function joinClub(clubId) {
    await supabase.from("club_members").insert({ club_id: clubId, user_id: session.user.id });
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
    setForm({ name: "", description: "", category: "", subcategory: "" });
    setShowForm(false);
    loadContext();
    setSaving(false);
  }

  const filteredClubs = filterCat === "Tous" ? allClubs : allClubs.filter(c => c.category === filterCat);

  if (selectedUser) return <ProfilPublic userId={selectedUser} session={session} onBack={() => setSelectedUser(null)} />;
  if (selectedClub) return <Clubs session={session} initialClub={selectedClub} onBack={() => setSelectedClub(null)} />;

  return (
    <div>
      {/* Barre de recherche */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <input style={{ ...inp, paddingLeft: 40 }} placeholder="Rechercher un investisseur, un club…" value={query} onChange={e => setQuery(e.target.value)} />
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "rgba(255,255,255,0.3)" }}>🔍</span>
        {query && <button onClick={() => setQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}>✕</button>}
      </div>

      {/* Résultats de recherche */}
      {query.length >= 2 ? (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[["users", "👤 Investisseurs"], ["clubs", "🏛️ Clubs"]].map(([id, label]) => (
              <button key={id} onClick={() => setSearchTab(id)} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${searchTab === id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: searchTab === id ? "rgba(159,225,203,0.1)" : "none", color: searchTab === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
                {label}
              </button>
            ))}
          </div>

          {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", padding: "1rem 0" }}>Recherche…</div>}

          {!loading && searchTab === "users" && users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u.id)} style={{ ...card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <Avatar name={u.full_name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{u.full_name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>@{u.username}{u.city ? ` · ${u.city}` : ""}{u.strategy ? ` · ${u.strategy}` : ""}</div>
                {u.streak_mois > 0 && <div style={{ fontSize: 11, color: "#F0CB7B", marginTop: 2 }}>🔥 {u.streak_mois} mois</div>}
              </div>
              {friendIds.includes(u.id) ? <span style={{ fontSize: 12, color: "#9FE1CB" }}>✓ Ami</span>
                : pendingIds.includes(u.id) ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>En attente</span>
                : <button onClick={() => sendRequest(u.id)} style={{ ...btnSm, borderColor: "#9FE1CB", color: "#9FE1CB" }}>+ Suivre</button>}
            </div>
          ))}

          {!loading && searchTab === "clubs" && clubs.map(club => (
            <div key={club.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{club.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{club.subcategory}</div>
              </div>
              {myClubIds.includes(club.id) ? <span style={{ fontSize: 12, color: "#9FE1CB" }}>✓ Membre</span>
                : <button onClick={() => joinClub(club.id)} style={{ ...btnSm, borderColor: "#9FE1CB", color: "#9FE1CB" }}>Rejoindre</button>}
            </div>
          ))}

          {!loading && searchTab === "users" && users.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Aucun investisseur trouvé</div>}
          {!loading && searchTab === "clubs" && clubs.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Aucun club trouvé</div>}
        </div>
      ) : (
        <>
          {/* Onglets Marchés / Clubs / Super Investors */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[["marches", "🌍 Marchés"], ["clubs", "🏛️ Clubs"], ["super", "🏆 Super Investors"]].map(([id, label]) => (
              <button key={id} onClick={() => { setSection(id); setFilterCat('Tous'); }} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${section === id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: section === id ? "rgba(159,225,203,0.1)" : "none", color: section === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Marchés */}
          {section === "marches" && <Marches />}

          {/* Clubs */}
          {section === "clubs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["Tous","Tous"],["📈 Actions","Actions"],["📊 ETF","ETF"],["🏦 Fonds","Fonds"],["📉 Obligations","Oblig."],["🏠 Immobilier","Immo"],["💰 Patrimoine & Stratégie","Stratégie"],["₿ Crypto","Crypto"]].map(([key,label]) => (
                    <button key={key} onClick={() => setFilterCat(key)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filterCat === key ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: filterCat === key ? "rgba(159,225,203,0.1)" : "none", color: filterCat === key ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ background: "#9FE1CB", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>
                  {showForm ? "Annuler" : "+ Créer"}
                </button>
              </div>

              {showForm && (
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Créer un club</div>
                  <input style={{ ...inp, marginBottom: 10 }} placeholder="Nom du club" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <textarea style={{ ...inp, height: 60, resize: "none", marginBottom: 10 }} placeholder="Description (optionnel)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {Object.keys(CATEGORIES).map(cat => (
                      <button key={cat} onClick={() => setForm({ ...form, category: cat, subcategory: "" })} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${form.category === cat ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: form.category === cat ? "rgba(159,225,203,0.1)" : "none", color: form.category === cat ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>{cat}</button>
                    ))}
                  </div>
                  {form.category && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {CATEGORIES[form.category].map(sub => (
                        <button key={sub} onClick={() => setForm({ ...form, subcategory: sub })} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${form.subcategory === sub ? "#9FE1CB" : "rgba(255,255,255,0.08)"}`, background: form.subcategory === sub ? "rgba(159,225,203,0.08)" : "none", color: form.subcategory === sub ? "#9FE1CB" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit" }}>{sub}</button>
                      ))}
                    </div>
                  )}
                  {error && <div style={{ fontSize: 13, color: "#F08080", marginBottom: 8 }}>⚠️ {error}</div>}
                  <button onClick={createClub} disabled={saving} style={{ background: "#9FE1CB", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>{saving ? "Création…" : "Créer"}</button>
                </div>
              )}

              {filteredClubs.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem 0" }}>Aucun club — crée le premier ! 🚀</div>}

              {filteredClubs.map(club => (
                <div key={club.id} onClick={() => setSelectedClub(club)} style={{ ...card, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{club.name}</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{club.subcategory}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>👥 {memberCounts[club.id] || 0} membre{(memberCounts[club.id] || 0) > 1 ? "s" : ""}</span>
                        {myClubIds.includes(club.id) && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>✓ Membre</span>}
                      </div>
                      {club.description && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{club.description}</div>}
                    </div>
                    {!myClubIds.includes(club.id) && (
                      <button onClick={() => joinClub(club.id)} style={{ ...btnSm, borderColor: "#9FE1CB", color: "#9FE1CB", flexShrink: 0 }}>+ Rejoindre</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Super Investors */}
          {section === "super" && (
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 16, lineHeight: 1.6 }}>
                Suis les positions des plus grands investisseurs mondiaux via les déclarations 13F publiques.
              </div>
              {SUPER_INVESTORS.map((inv, i) => (
                <div key={inv.handle} style={{ ...card }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{inv.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{inv.name}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{inv.desc}</div>
                      <div style={{ fontSize: 13, color: "#9FE1CB", fontWeight: 500 }}>{inv.perf}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#9FE1CB", fontWeight: 600, padding: "3px 10px", borderRadius: 999, border: "0.5px solid rgba(159,225,203,0.3)", background: "rgba(159,225,203,0.06)", flexShrink: 0 }}>Bientôt</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
