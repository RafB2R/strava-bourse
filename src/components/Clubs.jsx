import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { syncBadges } from "../badges";
import { T, T as TLive } from "../theme";
import { MAX_IMAGES, ACCEPT_ATTR, isImage, compressImage, uploadImages, removeImages, MAX_FILES, FILE_ACCEPT_ATTR, checkFile, uploadFiles, removeFiles } from "../media";
import { PostImages, ComposerPreviews, PostFiles, ComposerFiles } from "./PostMedia";
import { RichText, TickerChips, TagField } from "./PostText";
import { finalizeTags } from "../tags";
import IndexDetail from "./IndexDetail";
import { detailFor } from "../indices";
import { useDetailView } from "../useDetailView";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { t } from "../i18n";

// Prévient les membres mentionnés dans un post ou une réponse de club
async function notifyMentions(tags, myId, data) {
  for (const m of tags?.mentions || []) {
    if (m.id !== myId) await supabase.from("notifications").insert({ user_id: m.id, type: "mention", data });
  }
}

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

// L'emoji en tête de la catégorie (stockée en base) est affiché comme une icône
const CAT_ICON_NAMES = { "₿": "bitcoin" };
const catEmoji = cat => cat?.split(" ")[0];
const catText = cat => cat?.split(" ").slice(1).join(" ");
function CatIcon({ category, size = 14 }) {
  const e = catEmoji(category);
  return <Icon name={CAT_ICON_NAMES[e]} emoji={e} size={size} />;
}
const inl = { display: "inline-flex", alignItems: "center", gap: 5 };
const PAGE_SIZE = 10;

const card = (T) => ({ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 });
const inp = (T) => ({ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: `0.5px solid ${T.borderStrong}`, background: T.bgCard, color: T.text, fontFamily: "inherit", marginBottom: 10, display: "block" });
const btn = (T) => ({ background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 });
const btnSm = (T) => ({ background: "transparent", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" });
const lbl = (T) => ({ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" });


function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return t("à l'instant");
  if (diff < 3600) return t("il y a {n} min", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("il y a {n}h", { n: Math.floor(diff / 3600) });
  return t("il y a {n} j", { n: Math.floor(diff / 86400) });
}

function Post({ post, session, isMember, onReact, onDelete, onAsset, onProfile }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyInput, setReplyInput] = useState("");
  const [replyTags, setReplyTags] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const myReactions = post.reactions?.filter(r => r.user_id === session.user.id).map(r => r.type) || [];
  const reactionCounts = REACTIONS.reduce((acc, r) => { acc[r] = post.reactions?.filter(x => x.type === r).length || 0; return acc; }, {});

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
    const text = replyInput.trim();
    const tags = finalizeTags(text, replyTags);
    const row = { post_id: post.id, user_id: session.user.id, content: text };
    if (tags) row.tags = tags;
    const { error } = await supabase.from("club_replies").insert(row);
    if (!error) notifyMentions(tags, session.user.id, { club_id: post.club_id, post_id: post.id, excerpt: text.slice(0, 80) });
    setReplyInput("");
    setReplyTags(null);
    setSendingReply(false);
    await loadReplies();
    setShowReplies(true);
  }

  async function deleteReply(id) {
    await supabase.from("club_replies").delete().eq("id", id);
    loadReplies();
  }

  return (
    <div style={{ ...card(T), marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar userId={post.user_id} name={post.author?.full_name} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{post.author?.full_name}</span>
            {post.author?.username && <span style={{ fontSize: 12, color: T.textFaint }}>@{post.author.username}</span>}
            <span style={{ fontSize: 11, color: T.textFaint }}>{timeAgo(post.created_at)}</span>
            {post.user_id === session.user.id && (
              <button onClick={() => onDelete(post.id)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center" }} aria-label={t("Supprimer")}><Icon name="close" size={13} /></button>
            )}
          </div>
          {post.content?.trim() && (
            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 10, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
              <RichText text={post.content} tickers={post.tags?.tickers} mentions={post.tags?.mentions} T={T} onAsset={onAsset} onProfile={onProfile} />
            </div>
          )}
          <TickerChips tickers={post.tags?.tickers} T={T} onAsset={onAsset} />
          <PostImages images={post.images} T={T} />
          <PostFiles files={post.files} T={T} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {REACTIONS.map(r => (
              <button key={r} onClick={() => isMember && onReact(post.id, r)} style={{ background: myReactions.includes(r) ? T.accentBg : T.bgCard, border: `0.5px solid ${myReactions.includes(r) ? T.accentBorder : T.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, color: myReactions.includes(r) ? T.accent : T.textMuted, cursor: isMember ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon emoji={r} size={14} /> {reactionCounts[r] > 0 && <span style={{ fontSize: 11 }}>{reactionCounts[r]}</span>}
              </button>
            ))}
            <button onClick={toggleReplies} style={{ ...btnSm(T), fontSize: 12, padding: "3px 10px", marginLeft: 4, ...inl }}>
              <Icon name="comment" size={13} /> {post.reply_count > 0 ? t(post.reply_count > 1 ? "{n} réponses" : "{n} réponse", { n: post.reply_count }) : t("Répondre")}
            </button>
          </div>
        </div>
      </div>

      {showReplies && (
        <div style={{ marginTop: 14, paddingLeft: 44, borderLeft: `1.5px solid ${T.border}`, marginLeft: 17 }}>
          {loadingReplies && <div style={{ fontSize: 12, color: T.textFaint, padding: "8px 0" }}>{t("Chargement…")}</div>}
          {replies.map(reply => (
            <div key={reply.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Avatar userId={reply.user_id} name={reply.author?.full_name} size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{reply.author?.full_name}</span>
                  {reply.author?.username && <span style={{ fontSize: 11, color: T.textFaint }}>@{reply.author.username}</span>}
                  <span style={{ fontSize: 11, color: T.textFaint }}>{timeAgo(reply.created_at)}</span>
                  {reply.user_id === session.user.id && <button onClick={() => deleteReply(reply.id)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center" }} aria-label={t("Supprimer")}><Icon name="close" size={12} /></button>}
                </div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, background: T.bgSubtle, borderRadius: 8, padding: "7px 10px", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                  <RichText text={reply.content} tickers={reply.tags?.tickers} mentions={reply.tags?.mentions} T={T} onAsset={onAsset} onProfile={onProfile} />
                </div>
              </div>
            </div>
          ))}
          {isMember && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <Avatar userId={session.user.id} name={session.user.email} size={26} />
              <TagField as="input" style={{ ...inp(T), marginBottom: 0, flex: 1, fontSize: 12, padding: "7px 10px" }} placeholder={t("Répondre… ($ valeur, @ membre)")}
                value={replyInput} onValueChange={setReplyInput} tags={replyTags} onTagsChange={setReplyTags} onSubmit={sendReply} myId={session.user.id} T={T} />
              <button onClick={sendReply} disabled={sendingReply || !replyInput.trim()} style={{ ...btn(T), padding: "7px 14px", fontSize: 12, flexShrink: 0, display: "flex", alignItems: "center" }} aria-label={t("Envoyer")}><Icon name="enter" size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Classement des membres d'un club (vue member_stats)
async function fetchClubRanking(clubId, userId) {
  const { data: memberships } = await supabase.from("club_members").select("user_id").eq("club_id", clubId);
  if (!memberships) return [];
  const { data: stats } = await supabase
    .from("member_stats")
    .select("id, full_name, username, streak_mois, perf, nb_badges")
    .in("id", memberships.map(m => m.user_id));
  return (stats || []).map(s => ({
    user_id: s.id,
    name: s.full_name || t("Investisseur"),
    username: s.username,
    streak: Number(s.streak_mois),
    perf: s.perf === null ? null : Number(s.perf),
    nbBadges: Number(s.nb_badges),
    isMe: s.id === userId,
  }));
}

// Une page de posts d'un club avec réactions et nombre de réponses, ou null en cas d'erreur
async function fetchClubPosts(clubId, sort, page) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: postsData, count } = await supabase.from("club_posts").select("*, author:profiles!club_posts_user_id_fkey(full_name, username)", { count: "exact" }).eq("club_id", clubId).order("created_at", { ascending: sort === "date" ? false : true }).range(from, to);
  if (!postsData) return null;
  const postsWithData = await Promise.all(postsData.map(async post => {
    const { data: reactions } = await supabase.from("club_reactions").select("*").eq("post_id", post.id);
    const { count: replyCount } = await supabase.from("club_replies").select("*", { count: "exact", head: true }).eq("post_id", post.id);
    return { ...post, reactions: reactions || [], reply_count: replyCount || 0, score: (reactions || []).length + (replyCount || 0) };
  }));
  const posts = sort === "popularite" ? [...postsWithData].sort((a, b) => b.score - a.score) : postsWithData;
  return { posts, total: count || 0 };
}

// Tous les clubs, leur nombre de membres et les clubs dont je suis membre
async function fetchClubs(userId) {
  const { data: allClubs } = await supabase.from("clubs").select("*, creator:profiles!clubs_creator_id_fkey(full_name, username)").order("created_at", { ascending: false });
  const { data: memberships } = await supabase.from("club_members").select("club_id").eq("user_id", userId);
  const counts = {};
  if (allClubs) {
    for (const club of allClubs) {
      const { count } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", club.id);
      counts[club.id] = count || 0;
    }
  }
  return { clubs: allClubs, counts, myClubIds: memberships ? memberships.map(m => m.club_id) : null };
}

function ClubRanking({ clubId, session }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("performance");

  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchClubRanking(clubId, userId).then(list => {
      if (ignore) return;
      setMembers(list);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [clubId, userId]);


  const sorted = [...members].sort((a, b) => {
    if (filter === "performance") return (b.perf ?? -Infinity) - (a.perf ?? -Infinity);
    if (filter === "regularite") return b.streak - a.streak;
    if (filter === "badges") return b.nbBadges - a.nbBadges;
    return 0;
  });

  const rankIcon = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[["performance", "up", "Performance"], ["regularite", "flame", "Régularité"], ["badges", "award", "Badges"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === id ? T.accent : T.border}`, background: filter === id ? T.accentBg : "none", color: filter === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", ...inl }}>
            <Icon name={icon} size={13} />{t(label)}
          </button>
        ))}
      </div>
      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>{t("Chargement…")}</div>}
      {!loading && sorted.map((m, i) => {
        const val = filter === "performance" ? (m.perf !== null ? `${m.perf >= 0 ? "+" : ""}${m.perf.toFixed(1)}%` : "—")
          : filter === "regularite" ? (m.streak > 0 ? <span style={inl}><Icon name="flame" size={14} />{t("{n} mois", { n: m.streak })}</span> : "—")
          : <span style={inl}><Icon name="award" size={14} />{m.nbBadges}</span>;
        const color = filter === "performance" ? (m.perf === null ? T.textFaint : m.perf >= 0 ? T.up : T.red) : filter === "regularite" ? T.yellow : T.gold;
        return (
          <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
            <div style={{ fontSize: 16, minWidth: 28, textAlign: "center" }}>
              {rankIcon(i) || <span style={{ fontSize: 13, color: T.textFaint }}>{i + 1}</span>}
            </div>
            <Avatar userId={m.user_id} name={m.name} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: m.isMe ? T.accent : T.text }}>
                {m.name}{m.isMe && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>· {t("moi")}</span>}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color }}>{val}</div>
          </div>
        );
      })}
    </div>
  );
}

function ClubDetail({ club, session, onBack, isMember, onJoin, onLeave, memberCount, onViewProfile }) {
  const [posts, setPosts] = useState([]);
  const [input, setInput] = useState("");
  const [inputTags, setInputTags] = useState(null);
  const [openAsset, showAsset, closeAsset] = useDetailView();   // fiche d'une valeur citée
  const [sending, setSending] = useState(false);
  const [postImages, setPostImages] = useState([]);   // images préparées (compressées) avec aperçu
  const [postFiles, setPostFiles] = useState([]);
  const [preparing, setPreparing] = useState(0);
  const [postError, setPostError] = useState("");
  const imageInput = useRef(null);
  const fileInput = useRef(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [clubTab, setClubTab] = useState("discussion");

  const [reloadKey, setReloadKey] = useState(0);
  const reloadPosts = () => setReloadKey(k => k + 1);

  useEffect(() => {
    let ignore = false;
    fetchClubPosts(club.id, sort, page).then(result => {
      if (ignore) return;
      if (result) { setPosts(result.posts); setTotal(result.total); }
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [club.id, sort, page, reloadKey]);

  async function addImages(list) {
    const files = [...(list || [])].filter(isImage);
    if (files.length === 0) return;
    setPostError("");
    const room = MAX_IMAGES - postImages.length - preparing;
    if (files.length > room) setPostError(t("{n} images maximum par post.", { n: MAX_IMAGES }));
    const batch = files.slice(0, Math.max(0, room));
    setPreparing(n => n + batch.length);
    for (const file of batch) {
      try {
        const img = await compressImage(file);
        setPostImages(p => [...p, { ...img, preview: URL.createObjectURL(img.blob) }]);
      } catch (e) {
        setPostError(e.message || t("Image illisible."));
      } finally {
        setPreparing(n => n - 1);
      }
    }
  }

  function addFiles(list) {
    const files = [...(list || [])];
    setPostError("");
    const ok = files.filter(f => { const err = checkFile(f); if (err) setPostError(err); return !err; });
    const room = MAX_FILES - postFiles.length;
    if (ok.length > room) setPostError(t("{n} fichiers maximum par post.", { n: MAX_FILES }));
    if (room > 0) setPostFiles(p => [...p, ...ok.slice(0, room)]);
  }

  const canPost = (input.trim() || postImages.length > 0 || postFiles.length > 0) && !sending && preparing === 0;

  async function sendPost() {
    if (!canPost) return;
    setSending(true); setPostError("");
    let images = [], files;
    try {
      images = await uploadImages(session.user.id, postImages);
      files = await uploadFiles(session.user.id, postFiles);
    } catch (e) {
      await removeImages(images.map(i => i.path));
      setPostError(e.message); setSending(false); return;
    }
    const content = input.trim();
    const tags = finalizeTags(content, inputTags);
    const row = { club_id: club.id, user_id: session.user.id, content };
    if (images.length) row.images = images;
    if (files.length) row.files = files;
    if (tags) row.tags = tags;
    const { data: created, error } = await supabase.from("club_posts").insert(row).select("id").single();
    if (error) {
      await Promise.all([removeImages(images.map(i => i.path)), removeFiles(files.map(f => f.path))]);
      setPostError(t("Publication impossible. Réessaie.")); setSending(false); return;
    }
    notifyMentions(tags, session.user.id, { club_id: club.id, post_id: created?.id, excerpt: content.slice(0, 80) });
    postImages.forEach(i => URL.revokeObjectURL(i.preview));
    setPostImages([]); setPostFiles([]); setInputTags(null);
    setInput(""); setSending(false); setPage(1); reloadPosts();
  }

  // Supprime le post, puis ses images et fichiers du stockage
  async function deletePost(id) {
    const post = posts.find(p => p.id === id);
    const { error } = await supabase.from("club_posts").delete().eq("id", id);
    if (!error && post) {
      await Promise.all([
        removeImages((post.images || []).map(i => i.path).filter(Boolean)),
        removeFiles((post.files || []).map(f => f.path).filter(Boolean)),
      ]);
    }
    reloadPosts();
  }

  async function handleReact(postId, type) {
    const post = posts.find(p => p.id === postId);
    const already = post?.reactions?.find(r => r.user_id === session.user.id && r.type === type);
    if (already) {
      await supabase.from("club_reactions").delete().eq("id", already.id);
    } else {
      await supabase.from("club_reactions").insert({ post_id: postId, user_id: session.user.id, type });
      // Notifier l'auteur du post si c'est pas soi-même
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== session.user.id) {
        const { data: me } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
        await supabase.from("notifications").insert({ user_id: post.user_id, type: "post_reaction", data: { from_name: me?.full_name, reaction: type, post_id: postId } });
      }
    }
    reloadPosts();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (openAsset) {
    return <IndexDetail index={detailFor(openAsset)} T={T} backLabel={`← ${club.name}`} initialPeriod="1y" onBack={closeAsset} />;
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSm(T), marginBottom: 16 }}>{t("← Retour")}</button>

      <div style={card(T)}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}><CatIcon category={club.category} size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>{club.name}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>{t(club.subcategory)}</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.bgSubtle, color: T.textMuted, ...inl, gap: 4 }}><Icon name="users" size={12} />{t(memberCount > 1 ? "{n} membres" : "{n} membre", { n: memberCount })}</span>
            </div>
            {club.description && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginTop: 6 }}>{club.description}</div>}
          </div>
          {isMember ? <button onClick={onLeave} style={btnSm(T)}>{t("Quitter")}</button> : <button onClick={onJoin} style={{ ...btnSm(T), borderColor: T.accent, color: T.accent }}>{t("+ Rejoindre")}</button>}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["discussion", "comment", "Discussion"], ["classement", "trophy", "Classement"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setClubTab(id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${clubTab === id ? T.accent : T.border}`, background: clubTab === id ? T.accentBg : "none", color: clubTab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", ...inl, gap: 6 }}>
            <Icon name={icon} size={14} />{t(label)}
          </button>
        ))}
      </div>

      {/* Classement */}
      {clubTab === "classement" && (
        <div style={card(T)}>
          <ClubRanking key={club.id} clubId={club.id} session={session} />
        </div>
      )}

      {/* Discussion */}
      {clubTab === "discussion" && (
        <div>
          {isMember && (
            <div style={{ ...card(T), marginBottom: 20 }}>
              <TagField as="textarea" style={{ ...inp(T), marginBottom: 8, height: 80, resize: "none" }} placeholder={t("Partage une idée, une question… $ pour citer une valeur, @ pour un membre")}
                value={input} onValueChange={setInput} tags={inputTags} onTagsChange={setInputTags} myId={session.user.id} T={T}
                onPaste={e => { const files = [...e.clipboardData.files].filter(isImage); if (files.length) { e.preventDefault(); addImages(files); } }} />
              <ComposerPreviews items={postImages} onRemove={i => setPostImages(p => p.filter((_, j) => j !== i))} T={T} />
              <ComposerFiles files={postFiles} onRemove={i => setPostFiles(p => p.filter((_, j) => j !== i))} T={T} />
              {preparing > 0 && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>{t("Préparation de l'image…")}</div>}
              {postError && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{postError}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                <input ref={imageInput} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={e => { addImages(e.target.files); e.target.value = ""; }} />
                <input ref={fileInput} type="file" accept={FILE_ACCEPT_ATTR} multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                <button onClick={() => imageInput.current?.click()} disabled={postImages.length + preparing >= MAX_IMAGES}
                  style={{ background: "none", border: "none", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontWeight: 600, color: T.purple, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, minHeight: 36 }} aria-label={t("Photo")}><Icon name="image" size={18} /><span className="tool-label">{t("Photo")}</span></button>
                <button onClick={() => fileInput.current?.click()} disabled={postFiles.length >= MAX_FILES} title={t("PDF, Excel, Word, PowerPoint, CSV · 10 Mo max")}
                  style={{ background: "none", border: "none", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontWeight: 600, color: T.purple, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, minHeight: 36 }} aria-label={t("Fichier")}><Icon name="clip" size={18} /><span className="tool-label">{t("Fichier")}</span></button>
                <span style={{ flex: 1 }} />
                <button style={{ ...btn(T), padding: "8px 20px", opacity: canPost ? 1 : 0.5 }} onClick={sendPost} disabled={!canPost}>{sending ? t("Publication…") : t("Publier")}</button>
              </div>
            </div>
          )}
          {!isMember && <div style={{ textAlign: "center", padding: "1rem 0 1.5rem", fontSize: 13, color: T.textFaint }}>{t("Rejoins ce club pour participer aux discussions")}</div>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t(total > 1 ? "{n} posts" : "{n} post", { n: total })}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["date", "clock", "Récents"], ["popularite", "flame", "Populaires"]].map(([id, icon, label]) => (
                <button key={id} onClick={() => { if (id !== sort) { setLoading(true); setSort(id); setPage(1); } }} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${sort === id ? T.accent : T.border}`, background: sort === id ? T.accentBg : "none", color: sort === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", ...inl }}><Icon name={icon} size={12} />{t(label)}</button>
              ))}
            </div>
          </div>

          {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Chargement…")}</div>}
          {!loading && posts.length === 0 && <div style={{ ...card(T), textAlign: "center", color: T.textFaint, fontSize: 13, padding: "2rem" }}>{t("Aucun post encore — lance la discussion !")}</div>}
          {posts.map(post => (
            <Post key={post.id} post={post} session={session} isMember={isMember} onReact={handleReact} onDelete={deletePost}
              onAsset={showAsset} onProfile={id => onViewProfile?.(id)} />
          ))}

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setLoading(true); setPage(p => Math.max(1, p - 1)); }} disabled={page === 1} style={{ ...btnSm(T), opacity: page === 1 ? 0.3 : 1 }}>{t("← Préc.")}</button>
              <span style={{ fontSize: 13, color: T.textMuted, padding: "5px 12px" }}>{page} / {totalPages}</span>
              <button onClick={() => { setLoading(true); setPage(p => Math.min(totalPages, p + 1)); }} disabled={page === totalPages} style={{ ...btnSm(T), opacity: page === totalPages ? 0.3 : 1 }}>{t("Suiv. →")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Met en couleur les occurrences de la recherche, sans injecter de HTML
function highlight(text, query, color) {
  if (!query) return text;
  const lower = text.toLowerCase(), q = query.toLowerCase();
  const parts = [];
  let from = 0, at;
  while (q && (at = lower.indexOf(q, from)) !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<span key={at} style={{ color }}>{text.slice(at, at + q.length)}</span>);
    from = at + q.length;
  }
  parts.push(text.slice(from));
  return parts;
}

export default function Clubs({ session, initialClub = null, onBack = null , T: TProp, onViewProfile }) {
  const T = TProp || TLive;
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
  const [selectedClub, setSelectedClub] = useState(initialClub);
  const [form, setForm] = useState({ name: "", description: "", category: "", subcategory: "" });

  const [reloadKey, setReloadKey] = useState(0);
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchClubs(userId).then(({ clubs, counts, myClubIds }) => {
      if (ignore) return;
      if (clubs) { setClubs(clubs); setMemberCounts(counts); }
      if (myClubIds) setMyClubs(myClubIds);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [userId, reloadKey]);

  async function createClub() {
    setError("");
    if (!form.name.trim()) return setError(t("Donne un nom au club."));
    if (!form.category) return setError(t("Choisis une catégorie."));
    if (!form.subcategory) return setError(t("Choisis une sous-catégorie."));
    setSaving(true);
    const { data, error: err } = await supabase.from("clubs").insert({ name: form.name.trim(), description: form.description.trim(), category: form.category, subcategory: form.subcategory, creator_id: session.user.id }).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("club_members").insert({ club_id: data.id, user_id: session.user.id });
    syncBadges();
    setForm({ name: "", description: "", category: "", subcategory: "" });
    setShowForm(false); setReloadKey(k => k + 1); setSaving(false);
  }

  async function joinClub(clubId) {
    await supabase.from("club_members").insert({ club_id: clubId, user_id: session.user.id });
    syncBadges();
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
      <div>
      <ClubDetail
        club={selectedClub}
        session={session}
        onBack={() => { setSelectedClub(null); if (onBack) onBack(); }}
        isMember={myClubs.includes(selectedClub.id)}
        onJoin={() => joinClub(selectedClub.id)}
        onLeave={() => leaveClub(selectedClub.id)}
        memberCount={memberCounts[selectedClub.id] || 0}
        onViewProfile={onViewProfile}
      />
      </div>
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
          <button key={v} onClick={() => setView(v)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${view === v ? T.accent : T.border}`, background: view === v ? T.accentBg : "none", color: view === v ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", ...inl, gap: 6 }}>
            <Icon name={v === "explorer" ? "search" : "users"} size={14} />{v === "explorer" ? t("Explorer") : t("Mes clubs ({n})", { n: myClubs.length })}
          </button>
        ))}
        <button onClick={() => setShowForm(!showForm)} style={{ ...btn(T), marginLeft: "auto", padding: "7px 16px" }}>
          {showForm ? t("Annuler") : t("+ Créer")}
        </button>
      </div>

      {showForm && (
        <div style={card(T)}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>{t("Créer un club")}</div>
          <span style={lbl(T)}>{t("Nom du club")}</span>
          <input style={inp(T)} placeholder={t("ex: ETF World Investors France")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <span style={lbl(T)}>{t("Description (optionnel)")}</span>
          <textarea style={{ ...inp(T), height: 70, resize: "vertical" }} placeholder={t("De quoi parle ce club ?")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <span style={lbl(T)}>{t("Catégorie principale")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} onClick={() => setForm({ ...form, category: cat, subcategory: "" })} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${form.category === cat ? T.accent : T.border}`, background: form.category === cat ? T.accentBg : "none", color: form.category === cat ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", ...inl }}><CatIcon category={cat} size={13} />{t(catText(cat))}</button>
            ))}
          </div>
          {form.category && (
            <>
              <span style={lbl(T)}>{t("Sous-catégorie")}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {CATEGORIES[form.category].map(sub => (
                  <button key={sub} onClick={() => setForm({ ...form, subcategory: sub })} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${form.subcategory === sub ? T.accent : T.border}`, background: form.subcategory === sub ? T.accentBg : "none", color: form.subcategory === sub ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t(sub)}</button>
                ))}
              </div>
            </>
          )}
          {error && <div style={{ fontSize: 13, color: T.red, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="warning" size={14} />{error}</div>}
          <button style={btn(T)} onClick={createClub} disabled={saving}>{saving ? t("Création…") : t("Créer le club")}</button>
        </div>
      )}

      {!showForm && view === "explorer" && (
        <>
          <input style={{ ...inp(T), marginBottom: 12 }} placeholder={t("Rechercher un club par nom…")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => { setFilterCat(cat); setFilterSub("Tous"); }} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filterCat === cat ? T.accent : T.border}`, background: filterCat === cat ? T.accentBg : "none", color: filterCat === cat ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", ...inl }}>
                {cat !== "Tous" && <CatIcon category={cat} size={13} />}{cat === "Tous" ? t("Tous") : t(catText(cat))}
              </button>
            ))}
          </div>
          {filterCat !== "Tous" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => setFilterSub("Tous")} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${filterSub === "Tous" ? T.accent : T.border}`, background: filterSub === "Tous" ? T.accentBg : "none", color: filterSub === "Tous" ? T.accent : T.textFaint, cursor: "pointer", fontFamily: "inherit" }}>{t("Tous")}</button>
              {CATEGORIES[filterCat].map(sub => (
                <button key={sub} onClick={() => setFilterSub(sub)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${filterSub === sub ? T.accent : T.border}`, background: filterSub === sub ? T.accentBg : "none", color: filterSub === sub ? T.accent : T.textFaint, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t(sub)}</button>
              ))}
            </div>
          )}
          {filterCat === "Tous" && <div style={{ marginBottom: 16 }} />}
          {searchQuery && <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 12 }}>{t(filteredClubs.length > 1 ? "{n} résultats pour \"{query}\"" : "{n} résultat pour \"{query}\"", { n: filteredClubs.length, query: searchQuery })}</div>}
          {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Chargement…")}</div>}
          {!loading && filteredClubs.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem 0" }}>{searchQuery ? t("Aucun club pour \"{query}\"", { query: searchQuery }) : t("Aucun club — crée le premier !")}</div>}
          {filteredClubs.map(club => (
            <div key={club.id} style={{ ...card(T), cursor: "pointer" }} onClick={() => setSelectedClub(club)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}><CatIcon category={club.category} size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                    {highlight(club.name, searchQuery, T.accent)}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>{t(club.subcategory)}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.bgSubtle, color: T.textMuted, ...inl, gap: 4 }}><Icon name="users" size={12} />{t((memberCounts[club.id] || 0) > 1 ? "{n} membres" : "{n} membre", { n: memberCounts[club.id] || 0 })}</span>
                    {myClubs.includes(club.id) && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent, ...inl, gap: 4 }}><Icon name="check" size={11} />{t("Membre")}</span>}
                  </div>
                  {club.description && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{club.description}</div>}
                </div>
                <div style={{ fontSize: 18, color: T.textFaint }}>›</div>
              </div>
            </div>
          ))}
        </>
      )}

      {view === "mes-clubs" && !showForm && (
        <>
          {myClubsData.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem 0" }}>{t("Tu n'as rejoint aucun club")}</div>}
          {myClubsData.map(club => (
            <div key={club.id} style={{ ...card(T), cursor: "pointer" }} onClick={() => setSelectedClub(club)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}><CatIcon category={club.category} size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{club.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>{t(club.subcategory)}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.bgSubtle, color: T.textMuted, ...inl, gap: 4 }}><Icon name="users" size={12} />{t((memberCounts[club.id] || 0) > 1 ? "{n} membres" : "{n} membre", { n: memberCounts[club.id] || 0 })}</span>
                  </div>
                </div>
                <div style={{ fontSize: 18, color: T.textFaint }}>›</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
