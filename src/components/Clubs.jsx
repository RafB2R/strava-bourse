import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const CATEGORIES = {
  "📈 Actions": ["Actions France", "Actions Europe", "Actions USA", "Actions Monde", "Actions Émergents", "Small Caps", "Value Investing", "Growth Investing", "Dividendes", "Stock Picking"],
  "📊 ETF": ["ETF Monde (MSCI World)", "ETF S&P 500", "ETF Europe", "ETF Émergents", "ETF Thématiques", "ETF Dividendes", "ETF Obligataires", "ETF Immobilier (REIT)"],
  "🏦 Fonds": ["Fonds Actifs", "Fonds Mixtes", "Private Equity", "Hedge Funds"],
  "📉 Obligations": ["Obligations État", "Obligations Entreprises", "Obligations Émergentes", "High Yield"],
  "🏠 Immobilier": ["SCPI", "REIT / SIIC", "Immobilier Direct", "Crowdfunding Immo"],
  "💰 Patrimoine & Stratégie": ["DCA Long Terme", "PEA", "Assurance Vie", "Retraite / PER", "Fiscalité", "Débutants"],
  "₿ Crypto": ["Bitcoin", "Altcoins", "DeFi", "NFT & Web3"],
};

const REACTIONS = ["👍", "🔥", "💡"];
const PAGE_SIZE = 10;

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", marginBottom: 10, display: "block" };
const btn = { background: "#9FE1CB", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const btnSm = { background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };
const lbl = { fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" };

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB", "rgba(240,153,123,0.12)|#F0997B", "rgba(175,169,236,0.12)|#AFA9EC", "rgba(123,184,240,0.12)|#7BB8F0", "rgba(240,203,123,0.12)|#F0CB7B"];
function Avatar({ name, size = 32 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function Post({ post, session, isMember, onReact, onDelete }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyInput, setReplyInput] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const myReactions = post.reactions?.filter(r => r.user_id === session.user.id).map(r => r.type) || [];
  const reactionCounts = REACTIONS.reduce((acc, r) => { acc[r] = post.reactions?.filter(x => x.type === r).length || 0; return acc; }, {});
  const totalReactions = Object.values(reactionCounts).reduce((s, v) => s + v, 0);

  async function loadReplies() {
    setLoadingReplies(true);
    const { data } = await supabase.from("club_replies").select("*, author:profiles!club_replies_user_id_fkey(full_name, username)").eq("post_id", post.id).order("created_at", { ascending: true });
    setReplies(data || []);
    setLoadingReplies(false);
  }

  async function toggleReplies() {
    if (!showReplies) await loadReplies();
    setShowReplies(p => !p);
  }

  async function sendReply() {
    if (!replyInput.trim() || sendingReply) return;
    setSendingReply(true);
    await supabase.from("club_replies").insert({ post_id: post.id, user_id: session.user.id, content: replyInput.trim() });
    setReplyInput("");
    setSendingReply(false);
    await loadReplies();
    setShowReplies(true);
  }

  async function deleteReply(id) {
    await supabase.from("club_replies").delete().eq("id", id);
    loadReplies();
  }

  return (
    <div style={{ ...card, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar name={post.author?.full_name} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{post.author?.full_name}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{timeAgo(post.created_at)}</span>
            {post.user_id === session.user.id && (
              <button onClick={() => onDelete(post.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>✕</button>
            )}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 10, wordBreak: "break-word" }}>{post.content}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {REACTIONS.map(r => (
              <button key={r} onClick={() => isMember && onReact(post.id, r)} style={{ background: myReactions.includes(r) ? "rgba(159,225,203,0.1)" : "rgba(255,255,255,0.04)", border: `0.5px solid ${myReactions.includes(r) ? "rgba(159,225,203,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, color: myReactions.includes(r) ? "#9FE1CB" : "rgba(255,255,255,0.45)", cursor: isMember ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                {r} {reactionCounts[r] > 0 && <span style={{ fontSize: 11 }}>{reactionCounts[r]}</span>}
              </button>
            ))}
            <button onClick={toggleReplies} style={{ ...btnSm, fontSize: 12, padding: "3px 10px", marginLeft: 4 }}>
              💬 {post.reply_count > 0 ? `${post.reply_count} réponse${post.reply_count > 1 ? "s" : ""}` : "Répondre"}
            </button>
          </div>
        </div>
      </div>

      {showReplies && (
        <div style={{ marginTop: 14, paddingLeft: 44, borderLeft: "1.5px solid rgba(255,255,255,0.06)", marginLeft: 17 }}>
          {loadingReplies && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>Chargement…</div>}
          {replies.map(reply => (
            <div key={reply.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Avatar name={reply.author?.full_name} size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{reply.author?.full_name}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{timeAgo(reply.created_at)}</span>
                  {reply.user_id === session.user.id && <button onClick={() => deleteReply(reply.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>✕</button>}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "7px 10px", wordBreak: "break-word" }}>{reply.content}</div>
              </div>
            </div>
          ))}
          {isMember && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <Avatar name={session.user.email} size={26} />
              <input style={{ ...inp, marginBottom: 0, flex: 1, fontSize: 12, padding: "7px 10px" }} placeholder="Répondre…" value={replyInput} onChange={e => setReplyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()} />
              <button onClick={sendReply} disabled={sendingReply || !replyInput.trim()} style={{ ...btn, padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>↵</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClubDetail({ club, session, onBack, isMember, onJoin, onLeave, memberCount }) {
  const [posts, setPosts] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { loadPosts(); }, [club.id, sort, page]);

  async function loadPosts() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: postsData, count } = await supabase
      .from("club_posts")
      .select("*, author:profiles!club_posts_user_id_fkey(full_name, username)", { count: "exact" })
      .eq("club_id", club.id)
      .order("created_at", { ascending: sort === "date" ? false : true })
      .range(from, to);

    if (postsData) {
      const postsWithData = await Promise.all(postsData.map(async post => {
        const { data: reactions } = await supabase.from("club_reactions").select("*").eq("post_id", post.id);
        const { count: replyCount } = await supabase.from("club_replies").select("*", { count: "exact", head: true }).eq("post_id", post.id);
        return { ...post, reactions: reactions || [], reply_count: replyCount || 0, score: (reactions || []).length + (replyCount || 0) };
      }));

      const sorted = sort === "popularite"
        ? [...postsWithData].sort((a, b) => b.score - a.score)
        : postsWithData;

      setPosts(sorted);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  async function sendPost() {
    if (!input.trim() || sending) return;
    setSending(true);
    await supabase.from("club_posts").insert({ club_id: club.id, user_id: session.user.id, content: input.trim() });
    setInput("");
    setSending(false);
    setPage(1);
    loadPosts();
  }

  async function deletePost(id) {
    await supabase.from("club_posts").delete().eq("id", id);
    loadPosts();
  }

  async function handleReact(postId, type) {
    const post = posts.find(p => p.id === postId);
    const already = post?.reactions?.find(r => r.user_id === session.user.id && r.type === type);
    if (already) await supabase.from("club_reactions").delete().eq("id", already.id);
    else await supabase.from("club_reactions").insert({ post_id: postId, user_id: session.user.id, type });
    loadPosts();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSm, marginBottom: 16 }}>← Retour</button>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{club.name}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{club.subcategory}</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>👥 {memberCount} membre{memberCount > 1 ? "s" : ""}</span>
            </div>
            {club.description && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginTop: 6 }}>{club.description}</div>}
          </div>
          {isMember ? <button onClick={onLeave} style={btnSm}>Quitter</button> : <button onClick={onJoin} style={{ ...btnSm, borderColor: "#9FE1CB", color: "#9FE1CB" }}>+ Rejoindre</button>}
        </div>
      </div>

      {isMember && (
        <div style={{ ...card, marginBottom: 20 }}>
          <textarea style={{ ...inp, marginBottom: 8, height: 80, resize: "none" }} placeholder="Partage une idée, une question, une analyse…" value={input} onChange={e => setInput(e.target.value)} />
          <button style={{ ...btn, padding: "8px 20px" }} onClick={sendPost} disabled={sending || !input.trim()}>{sending ? "Publication…" : "Publier"}</button>
        </div>
      )}

      {!isMember && <div style={{ textAlign: "center", padding: "1rem 0 1.5rem", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Rejoins ce club pour participer aux discussions</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {total} post{total > 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["date", "🕐 Récents"], ["popularite", "🔥 Populaires"]].map(([id, label]) => (
            <button key={id} onClick={() => { setSort(id); setPage(1); }} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${sort === id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: sort === id ? "rgba(159,225,203,0.1)" : "none", color: sort === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem" }}>Chargement…</div>}
      {!loading && posts.length === 0 && <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "2rem" }}>Aucun post encore — lance la discussion ! 🚀</div>}

      {posts.map(post => (
        <Post key={post.id} post={post} session={session} isMember={isMember} onReact={handleReact} onDelete={deletePost} />
      ))}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btnSm, opacity: page === 1 ? 0.3 : 1 }}>← Préc.</button>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "5px 12px" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...btnSm, opacity: page === totalPages ? 0.3 : 1 }}>Suiv. →</button>
        </div>
      )}
    </div>
  );
}

export default function Clubs({ session }) {
  const [clubs, setClubs] = useState([]);
  const [myClubs, setMyClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterCat, setFilterCat] = useState("Tous");
  const [filterSub, setFilterSub] = useState("Tous");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("explorer");
  const [memberCounts, setMemberCounts] = useState({});
  const [selectedClub, setSelectedClub] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", subcategory: "" });

  useEffect(() => { loadClubs(); }, []);

  async function loadClubs() {
    setLoading(true);
    const { data: allClubs } = await supabase.from("clubs").select("*, creator:profiles!clubs_creator_id_fkey(full_name, username)").order("created_at", { ascending: false });
    const { data: memberships } = await supabase.from("club_members").select("club_id").eq("user_id", session.user.id);
    if (allClubs) {
      setClubs(allClubs);
      const counts = {};
      for (const club of allClubs) {
        const { count } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", club.id);
        counts[club.id] = count || 0;
      }
      setMemberCounts(counts);
    }
    if (memberships) setMyClubs(memberships.map(m => m.club_id));
    setLoading(false);
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
    loadClubs();
    setSaving(false);
  }

  async function joinClub(clubId) {
    await supabase.from("club_members").insert({ club_id: clubId, user_id: session.user.id });
    setMyClubs(p => [...p, clubId]);
    setMemberCounts(p => ({ ...p, [clubId]: (p[clubId] || 0) + 1 }));
  }

  async function leaveClub(clubId) {
    await supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", session.user.id);
    setMyClubs(p => p.filter(id => id !== clubId));
    setMemberCounts(p => ({ ...p, [clubId]: Math.max((p[clubId] || 1) - 1, 0) }));
    if (selectedClub?.id === clubId) setSelectedClub(null);
  }

  if (selectedClub) {
    return (
      <ClubDetail
        club={selectedClub}
        session={session}
        onBack={() => setSelectedClub(null)}
        isMember={myClubs.includes(selectedClub.id)}
        onJoin={() => joinClub(selectedClub.id)}
        onLeave={() => leaveClub(selectedClub.id)}
        memberCount={memberCounts[selectedClub.id] || 0}
      />
    );
  }

  const categories = ["Tous", ...Object.keys(CATEGORIES)];
  const filteredClubs = clubs
    .filter(c => filterCat === "Tous" || c.category === filterCat)
    .filter(c => filterSub === "Tous" || c.subcategory === filterSub)
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const myClubsData = clubs.filter(c => myClubs.includes(c.id));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["explorer", "mes-clubs"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${view === v ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: view === v ? "rgba(159,225,203,0.1)" : "none", color: view === v ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {v === "explorer" ? "🔍 Explorer" : `👥 Mes clubs (${myClubs.length})`}
          </button>
        ))}
        <button onClick={() => setShowForm(!showForm)} style={{ ...btn, marginLeft: "auto", padding: "7px 16px" }}>
          {showForm ? "Annuler" : "+ Créer"}
        </button>
      </div>

      {showForm && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Créer un club</div>
          <span style={lbl}>Nom du club</span>
          <input style={inp} placeholder="ex: ETF World Investors France" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <span style={lbl}>Description (optionnel)</span>
          <textarea style={{ ...inp, height: 70, resize: "vertical" }} placeholder="De quoi parle ce club ?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <span style={lbl}>Catégorie principale</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} onClick={() => setForm({ ...form, category: cat, subcategory: "" })} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${form.category === cat ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: form.category === cat ? "rgba(159,225,203,0.1)" : "none", color: form.category === cat ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>{cat}</button>
            ))}
          </div>
          {form.category && (
            <>
              <span style={lbl}>Sous-catégorie</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {CATEGORIES[form.category].map(sub => (
                  <button key={sub} onClick={() => setForm({ ...form, subcategory: sub })} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${form.subcategory === sub ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: form.subcategory === sub ? "rgba(159,225,203,0.1)" : "none", color: form.subcategory === sub ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>{sub}</button>
                ))}
              </div>
            </>
          )}
          {error && <div style={{ fontSize: 13, color: "#F08080", marginBottom: 10 }}>⚠️ {error}</div>}
          <button style={btn} onClick={createClub} disabled={saving}>{saving ? "Création…" : "Créer le club"}</button>
        </div>
      )}

      {!showForm && view === "explorer" && (
        <>
          <input
            style={{ ...inp, marginBottom: 12 }}
            placeholder="🔍 Rechercher un club par nom…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => { setFilterCat(cat); setFilterSub("Tous"); }} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filterCat === cat ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: filterCat === cat ? "rgba(159,225,203,0.1)" : "none", color: filterCat === cat ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {cat === "Tous" ? "Tous" : cat.split(" ").slice(1).join(" ")}
              </button>
            ))}
          </div>

          {filterCat !== "Tous" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => setFilterSub("Tous")} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${filterSub === "Tous" ? "#9FE1CB" : "rgba(255,255,255,0.08)"}`, background: filterSub === "Tous" ? "rgba(159,225,203,0.08)" : "none", color: filterSub === "Tous" ? "#9FE1CB" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit" }}>Tous</button>
              {CATEGORIES[filterCat].map(sub => (
                <button key={sub} onClick={() => setFilterSub(sub)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${filterSub === sub ? "#9FE1CB" : "rgba(255,255,255,0.08)"}`, background: filterSub === sub ? "rgba(159,225,203,0.08)" : "none", color: filterSub === sub ? "#9FE1CB" : "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{sub}</button>
              ))}
            </div>
          )}
          {filterCat === "Tous" && <div style={{ marginBottom: 16 }} />}

          {searchQuery && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>{filteredClubs.length} résultat{filteredClubs.length > 1 ? "s" : ""} pour "{searchQuery}"</div>}

          {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem" }}>Chargement…</div>}
          {!loading && filteredClubs.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem 0" }}>{searchQuery ? `Aucun club pour "${searchQuery}"` : "Aucun club — crée le premier ! 🚀"}</div>}

          {filteredClubs.map(club => (
            <div key={club.id} style={{ ...card, cursor: "pointer" }} onClick={() => setSelectedClub(club)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                    {searchQuery ? (
                      <span dangerouslySetInnerHTML={{ __html: club.name.replace(new RegExp(`(${searchQuery})`, "gi"), '<span style="color:#9FE1CB">$1</span>') }} />
                    ) : club.name}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{club.subcategory}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>👥 {memberCounts[club.id] || 0} membre{(memberCounts[club.id] || 0) > 1 ? "s" : ""}</span>
                    {myClubs.includes(club.id) && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>✓ Membre</span>}
                  </div>
                  {club.description && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{club.description}</div>}
                </div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.2)" }}>›</div>
              </div>
            </div>
          ))}
        </>
      )}

      {view === "mes-clubs" && !showForm && (
        <>
          {myClubsData.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem 0" }}>Tu n'as rejoint aucun club 🙂</div>}
          {myClubsData.map(club => (
            <div key={club.id} style={{ ...card, cursor: "pointer" }} onClick={() => setSelectedClub(club)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{club.category.split(" ")[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{club.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{club.subcategory}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>👥 {memberCounts[club.id] || 0} membre{(memberCounts[club.id] || 0) > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.2)" }}>›</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
