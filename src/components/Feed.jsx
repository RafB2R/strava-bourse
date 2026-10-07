import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T, T as TLive, avatarColors } from "../theme";
import { badgeFromData } from "../badges";
import { MOMENTS, MOMENT_TYPES, isMoment, momentSentence } from "../moments";
import { tradeTexts, TRADE_TYPES } from "../trades";
import MovementNote from "./MovementNote";
import ClubFeedCard from "./ClubFeedCard";
import { MAX_IMAGES, ACCEPT_ATTR, isImage, compressImage, uploadImages, removeImages, MAX_FILES, FILE_ACCEPT_ATTR, checkFile, uploadFiles, removeFiles } from "../media";
import { makePoll, isValidPoll, fetchPolls, vote, closeFinishedPolls } from "../polls";
import { PostImages, ComposerPreviews, PostFiles, ComposerFiles, PollEditor, PollView } from "./PostMedia";
import { AssetCard, AllocationCard, AssetPicker, AllocationPicker, AttachedChip } from "./PostAttachments";
import { CHART_PERIODS } from "../attachments";
import { RichText, TickerChips, TagSuggestions, TagField } from "./PostText";
import { tagAtCaret, finalizeTags } from "../tags";
import IndexDetail from "./IndexDetail";
import { detailFor } from "../indices";

function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
  const [bg, color] = avatarColors(name);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size*0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const BADGE_TYPES = ["badge"];
// Ce que montre le fil : posts, mouvements, moments et badges (pas les dividendes ni l'ajout d'un courtier)
const FEED_TYPES = ["post", ...TRADE_TYPES, ...MOMENT_TYPES, ...BADGE_TYPES];

function getActivityMeta(activity) {
  const d = activity.data || {};
  const name = activity.author?.full_name || "Quelqu'un";
  const badge = badgeFromData(d);
  const trade = tradeTexts(activity.type, d);
  if (trade) {
    const up = activity.type === "renforcement";
    return { tag: { renforcement: "Renforcement", allegement: "Allègement", vente: "Vente" }[activity.type], tagBg: up ? T.accentBg : "rgba(240,153,123,0.1)", tagColor: up ? T.accent : T.orange, title: `${name} ${trade.sentence}`, sub: trade.detail, stat: trade.stat };
  }
  if (isMoment(activity.type)) {
    const m = MOMENTS[activity.type];
    return { tag: m.tag, tagBg: "rgba(240,215,0,0.1)", tagColor: T.gold, title: momentSentence(activity.type, d, name), sub: m.sub?.(d) || "", stat: m.stat?.(d) || "" };
  }
  const map = {
    new_position: { tag: "Nouvelle position", tagBg: "rgba(123,184,240,0.1)", tagColor: T.blue, title: `${name} a ajouté une nouvelle position`, sub: d.label, stat: `${d.exposition || d.vehicule || ""}${d.broker ? ` · ${d.broker}` : ""}${d.percentage ? ` · ${d.percentage}%` : ""}` },
    renforcement: { tag: "Renforcement", tagBg: T.accentBg, tagColor: T.accent, title: `${name} a renforcé une position`, sub: d.label, stat: "" },
    vente: { tag: "Vente", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a vendu une position`, sub: d.label, stat: "" },
    allegement: { tag: "Allègement", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a allégé une position`, sub: d.label, stat: "" },
    dividende: { tag: "Dividende 💰", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a reçu un dividende`, sub: d.label, stat: "" },
    coupon: { tag: "Coupon", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a reçu un coupon`, sub: d.label, stat: "" },
    versement: { tag: "Versement", tagBg: T.accentBg, tagColor: T.accent, title: `${name} a effectué un versement`, sub: d.broker, stat: "" },
    retrait: { tag: "Retrait", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a effectué un retrait`, sub: d.broker, stat: "" },
    rebalancement: { tag: "Rééquilibrage", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a rééquilibré son portefeuille`, sub: "", stat: "" },
    suppression_position: { tag: "Position supprimée", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a supprimé une position`, sub: d.label, stat: "" },
    new_broker: { tag: "Nouveau broker", tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: `${name} a ajouté un broker`, sub: d.broker, stat: "" },
    badge: { tag: "Badge 🏅", tagBg: "rgba(240,215,0,0.08)", tagColor: T.gold, title: `${name} a débloqué un badge`, sub: badge.category, stat: `${badge.medal} ${badge.name}` },
  };
  return map[activity.type] || { tag: "Activité", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a eu une activité`, sub: "", stat: "" };
}

// Posts : ce que les membres écrivent · Activité : les mouvements (factuels)
// Moments : moments automatiques et badges
const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "posts", label: "Posts" },
  { id: "activite", label: "Activité" },
  { id: "moments", label: "Moments" },
];

const COMMENT_COLUMNS = "id, activity_id, user_id, content, tags, created_at, author:profiles!activity_comments_user_id_fkey(full_name)";

// Amis acceptés (moi inclus), activités à afficher selon le périmètre, avec leurs likes et commentaires
// Posts récents des clubs dont je suis membre (affichés dans le fil, avec « Tout » et « Posts »)
async function fetchMyClubPosts(userId) {
  const { data: memberships } = await supabase.from("club_members").select("club_id").eq("user_id", userId);
  const clubIds = (memberships || []).map(m => m.club_id);
  if (clubIds.length === 0) return [];
  const { data } = await supabase.from("club_posts")
    .select("*, author:profiles!club_posts_user_id_fkey(full_name, username), club:clubs(*)")
    .in("club_id", clubIds).order("created_at", { ascending: false }).limit(50);
  const posts = data || [];
  // Nombre de réponses par post, en une seule requête
  if (posts.length) {
    const { data: replies } = await supabase.from("club_replies").select("post_id").in("post_id", posts.map(p => p.id));
    const counts = {};
    for (const r of replies || []) counts[r.post_id] = (counts[r.post_id] || 0) + 1;
    for (const p of posts) p.reply_count = counts[p.id] || 0;
  }
  return posts.map(p => ({ ...p, kind: "club" }));
}

// « onlyUserId » : seulement les activités de ce membre, des types « onlyTypes »
// (onglets Activité et Posts d'un profil public)
async function fetchFeed(userId, scope, onlyUserId = null, onlyTypes = TRADE_TYPES) {
  closeFinishedPolls();
  const { data: friendships } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  const ids = [userId];
  if (friendships) friendships.forEach(f => {
    if (f.requester_id !== userId) ids.push(f.requester_id);
    if (f.receiver_id !== userId) ids.push(f.receiver_id);
  });
  let query = supabase.from("activities").select("*, author:profiles!activities_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(100);
  if (onlyUserId) query = query.eq("user_id", onlyUserId).in("type", onlyTypes);
  else {
    query = query.in("type", FEED_TYPES);
    if (scope === "amis") query = query.in("user_id", ids);
  }
  const { data } = await query;
  const activities = data || [];

  // Likes et commentaires des activités affichées
  const likes = {}, comments = {};
  const activityIds = activities.map(a => a.id);
  if (activityIds.length > 0) {
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      supabase.from("activity_likes").select("activity_id, user_id").in("activity_id", activityIds),
      supabase.from("activity_comments").select(COMMENT_COLUMNS).in("activity_id", activityIds).order("created_at"),
    ]);
    for (const l of likeRows || []) {
      const entry = likes[l.activity_id] ||= { count: 0, mine: false };
      entry.count++;
      if (l.user_id === userId) entry.mine = true;
    }
    for (const c of commentRows || []) (comments[c.activity_id] ||= []).push(c);
  }
  const pollIds = activities.filter(a => a.type === "post" && a.data?.poll).map(a => a.id);
  const [polls, clubPosts] = await Promise.all([fetchPolls(pollIds, userId), onlyUserId ? [] : fetchMyClubPosts(userId)]);
  return { ids, activities, likes, comments, polls, clubPosts };
}

// « onlyUserId » : version intégrée au profil public — mêmes cartes que le fil, limitées à ce
// membre, sans encadré de publication, choix Amis / Verio ni filtres.
// « only » : "trades" (onglet Activité, mouvements) ou "posts" (onglet Posts).
export default function Feed({ session, T: TProp, onViewProfile, onlyUserId = null, only = "trades", onOpenClub }) {
  const embedded = !!onlyUserId;
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const toolBtn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 34, minHeight: 36, background: "none", border: "none", borderRadius: 8, padding: "5px 6px", fontSize: 13, fontWeight: 600, color: T.purple, cursor: "pointer", fontFamily: "inherit" };
  const btnAct = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };

  const [activities, setActivities] = useState([]);
  const [clubPosts, setClubPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [scope, setScope] = useState("amis");
  const [friendIds, setFriendIds] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [openComment, setOpenComment] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentTags, setCommentTags] = useState({});  // tags choisis par commentaire en cours
  const [postInput, setPostInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [postImages, setPostImages] = useState([]);
  const [postError, setPostError] = useState("");
  const [preparing, setPreparing] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const docInput = useRef(null);
  const [postFiles, setPostFiles] = useState([]);
  const [pollOptions, setPollOptions] = useState(null); // null = pas de sondage
  const [pollDays, setPollDays] = useState(1);
  const [postAsset, setPostAsset] = useState(null);           // valeur citée { symbol, name, type, chart }
  const [postAllocation, setPostAllocation] = useState(null); // répartition { mode, rows }
  const [picker, setPicker] = useState(null);                 // "chart" | "allocation" (une valeur se cite avec $ dans le texte)
  const [postTickers, setPostTickers] = useState([]);         // valeurs identifiées dans le texte ($TTE.PA)
  const [postMentions, setPostMentions] = useState([]);       // membres identifiés (@pseudo)
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissedTag, setDismissedTag] = useState(null);
  const textRef = useRef(null);
  const [openAsset, setOpenAsset] = useState(null);           // fiche ouverte depuis un post
  const [noteEditing, setNoteEditing] = useState(null);       // mouvement dont l'auteur écrit la description
  const feedScroll = useRef(0);
  const [polls, setPolls] = useState({ counts: {}, mine: {} });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    supabase.from("profiles").select("full_name").eq("id", userId).single()
      .then(({ data }) => { if (!ignore) setProfile(data); });
    return () => { ignore = true; };
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    fetchFeed(userId, scope, onlyUserId, only === "posts" ? ["post"] : TRADE_TYPES).then(({ ids, activities, likes, comments, polls, clubPosts }) => {
      if (ignore) return;
      setClubPosts(clubPosts);
      setPolls(polls);
      setFriendIds(ids);
      setActivities(activities);
      setLikes(likes);
      setComments(comments);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [userId, scope, reloadKey, onlyUserId, only]);

  // Images choisies (bouton, coller ou glisser-déposer) : compressées tout de suite pour l'aperçu
  async function addImages(fileList) {
    const files = [...(fileList || [])].filter(isImage);
    if (files.length === 0) return;
    setPostError("");
    const room = MAX_IMAGES - postImages.length - preparing;
    if (room <= 0) { setPostError(`${MAX_IMAGES} images maximum par post.`); return; }
    if (files.length > room) setPostError(`${MAX_IMAGES} images maximum par post.`);
    const batch = files.slice(0, room);
    setPreparing(n => n + batch.length);
    for (const file of batch) {
      try {
        const img = await compressImage(file);
        setPostImages(p => [...p, { ...img, preview: URL.createObjectURL(img.blob) }]);
      } catch (e) {
        setPostError(e.message || "Image illisible.");
      } finally {
        setPreparing(n => n - 1);
      }
    }
  }

  function removeImage(i) {
    setPostImages(p => {
      URL.revokeObjectURL(p[i].preview);
      return p.filter((_, j) => j !== i);
    });
  }

  function addFiles(fileList) {
    const files = [...(fileList || [])];
    if (files.length === 0) return;
    setPostError("");
    const ok = [];
    for (const f of files) {
      const err = checkFile(f);
      if (err) setPostError(err); else ok.push(f);
    }
    const room = MAX_FILES - postFiles.length;
    if (ok.length > room) setPostError(`${MAX_FILES} fichiers maximum par post.`);
    if (room > 0) setPostFiles(p => [...p, ...ok.slice(0, room)]);
  }

  // Tag en cours de frappe (« $tot », « @ali ») et choix d'une suggestion
  const rawTag = focused ? tagAtCaret(postInput, caret) : null;
  const tag = rawTag && `${rawTag.start}${rawTag.sign}${rawTag.query}` !== dismissedTag ? rawTag : null;

  function pickTag(item) {
    if (!tag) return;
    const token = tag.sign === "$" ? `$${item.symbol} ` : `@${item.username} `;
    const next = postInput.slice(0, tag.start) + token + postInput.slice(caret);
    setPostInput(next);
    if (tag.sign === "$") setPostTickers(p => (p.some(t => t.symbol === item.symbol) ? p : [...p, { symbol: item.symbol, name: item.name, type: item.type }]));
    else setPostMentions(p => (p.some(m => m.id === item.id) ? p : [...p, { id: item.id, username: item.username, full_name: item.full_name }]));
    const pos = tag.start + token.length;
    setCaret(pos);
    requestAnimationFrame(() => { textRef.current?.focus(); textRef.current?.setSelectionRange(pos, pos); });
  }

  function openAssetDetail(asset) {
    feedScroll.current = window.scrollY;
    setOpenAsset(asset);
    window.scrollTo(0, 0);
  }

  function closeAssetDetail() {
    setOpenAsset(null);
    requestAnimationFrame(() => window.scrollTo(0, feedScroll.current));
  }

  const poll = pollOptions ? makePoll(pollOptions, pollDays) : null;
  const hasContent = postInput.trim() || postImages.length > 0 || postFiles.length > 0 || postAsset || postAllocation;

  async function publishPost() {
    const content = postInput.trim();
    if (!hasContent || posting || preparing) return;
    if (poll && !isValidPoll(poll)) { setPostError("Un sondage a besoin d'au moins 2 choix."); return; }
    if (poll && !content) { setPostError("Écris la question du sondage dans le texte du post."); return; }
    setPosting(true);
    setPostError("");
    let images, files;
    try {
      images = await uploadImages(userId, postImages);
      try {
        files = await uploadFiles(userId, postFiles);
      } catch (e) {
        await removeImages(images.map(i => i.path));
        throw e;
      }
    } catch (e) {
      setPostError(e.message);
      setPosting(false);
      return;
    }
    const data = { content };
    if (images.length) data.images = images;
    if (files.length) data.files = files;
    if (poll) data.poll = poll;
    if (postAsset) data.asset = postAsset;
    if (postAllocation) data.allocation = postAllocation;
    // Ne garder que les tags encore présents dans le texte
    const tickers = postTickers.filter(t => new RegExp(`\\$${t.symbol.replace(/[.^]/g, "\\$&")}(?![A-Za-z0-9])`, "i").test(content));
    const mentions = postMentions.filter(m => new RegExp(`@${m.username.replace(/\./g, "\\.")}(?![A-Za-z0-9_])`, "i").test(content));
    if (tickers.length) data.tickers = tickers;
    if (mentions.length) data.mentions = mentions;
    const { data: created, error } = await supabase.from("activities").insert({ user_id: userId, type: "post", data }).select("id").single();
    if (error) {
      await Promise.all([removeImages(images.map(i => i.path)), removeFiles(files.map(f => f.path))]);
      setPostError("Publication impossible. Réessaie.");
      setPosting(false);
      return;
    }
    // Prévient les membres mentionnés (le nom de l'expéditeur est fixé par la base)
    if (created?.id) {
      for (const m of mentions) {
        if (m.id !== userId) await supabase.from("notifications").insert({ user_id: m.id, type: "mention", data: { activity_id: created.id, excerpt: content.slice(0, 80) } });
      }
    }
    postImages.forEach(p => URL.revokeObjectURL(p.preview));
    setPostImages([]);
    setPostFiles([]);
    setPostTickers([]);
    setPostMentions([]);
    setPollOptions(null);
    setPollDays(1);
    setPostAsset(null);
    setPostAllocation(null);
    setPicker(null);
    setPostInput("");
    setPosting(false);
    setReloadKey(k => k + 1);
  }

  const likePending = useRef(new Set());

  // Supprime un de ses posts, puis ses images et fichiers du stockage
  async function deletePost(activity) {
    if (deleting) return;
    setDeleting(true);
    const { data, error } = await supabase.from("activities").delete().eq("id", activity.id).eq("user_id", userId).select("id");
    setDeleting(false);
    setConfirmDelete(null);
    if (error || !data?.length) return;
    setActivities(p => p.filter(a => a.id !== activity.id));
    await Promise.all([
      removeImages((activity.data?.images || []).map(i => i.path).filter(Boolean)),
      removeFiles((activity.data?.files || []).map(f => f.path).filter(Boolean)),
    ]);
  }

  // Vote affiché tout de suite, annulé si Supabase refuse (sondage terminé…)
  async function castVote(activityId, option) {
    const before = polls;
    setPolls(p => {
      const counts = [...(p.counts[activityId] || [])];
      counts[option] = (counts[option] || 0) + 1;
      return { counts: { ...p.counts, [activityId]: counts }, mine: { ...p.mine, [activityId]: option } };
    });
    const { error } = await vote(activityId, option);
    if (error) setPolls(before);
  }

  async function notify(toUserId, type, data) {
    if (toUserId === userId) return;
    await supabase.from("notifications").insert({ user_id: toUserId, type, data: { from_name: profile?.full_name, from_id: userId, ...data } });
  }

  // Mise à jour immédiate à l'écran, annulée si Supabase refuse
  async function toggleLike(activity) {
    const id = activity.id;
    if (likePending.current.has(id)) return;
    likePending.current.add(id);
    const current = likes[id] || { count: 0, mine: false };
    setLikes(p => ({ ...p, [id]: { count: current.count + (current.mine ? -1 : 1), mine: !current.mine } }));
    const { error } = current.mine
      ? await supabase.from("activity_likes").delete().eq("activity_id", id).eq("user_id", userId)
      : await supabase.from("activity_likes").insert({ activity_id: id, user_id: userId });
    likePending.current.delete(id);
    if (error) { setLikes(p => ({ ...p, [id]: current })); return; }
    if (!current.mine) notify(activity.user_id, "activity_like", { activity_id: id });
  }

  function toggleComment(id) { setOpenComment(p => ({ ...p, [id]: !p[id] })); }

  async function addComment(activity) {
    const id = activity.id;
    const text = (commentInputs[id] || "").trim();
    if (!text) return;
    const tags = finalizeTags(text, commentTags[id]);
    setCommentInputs(p => ({ ...p, [id]: "" }));
    const row = { activity_id: id, user_id: userId, content: text };
    if (tags) row.tags = tags;
    const { data, error } = await supabase.from("activity_comments").insert(row).select(COMMENT_COLUMNS).single();
    if (error) { setCommentInputs(p => ({ ...p, [id]: text })); return; }
    setCommentTags(p => ({ ...p, [id]: null }));
    setComments(p => ({ ...p, [id]: [...(p[id] || []), data] }));
    notify(activity.user_id, "activity_comment", { activity_id: id, excerpt: text.slice(0, 80) });
    // Membres mentionnés (l'auteur du post est déjà prévenu du commentaire)
    for (const m of tags?.mentions || []) {
      if (m.id !== userId && m.id !== activity.user_id) notify(m.id, "mention", { activity_id: id, excerpt: text.slice(0, 80) });
    }
  }

  async function deleteComment(activityId, commentId) {
    const { error } = await supabase.from("activity_comments").delete().eq("id", commentId);
    if (!error) setComments(p => ({ ...p, [activityId]: (p[activityId] || []).filter(c => c.id !== commentId) }));
  }

  const visibleActivities = activities.filter(a => {
    if (filter === "all") return true;
    if (filter === "posts") return a.type === "post";
    if (filter === "activite") return TRADE_TYPES.includes(a.type);
    if (filter === "moments") return MOMENT_TYPES.includes(a.type) || BADGE_TYPES.includes(a.type);
    return true;
  });
  // Posts de mes clubs, mêlés au fil par date (« Tout » et « Posts » seulement)
  const visible = filter === "all" || filter === "posts"
    ? [...visibleActivities, ...clubPosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : visibleActivities;



  if (openAsset) {
    return <IndexDetail index={detailFor(openAsset)} T={T} backLabel={embedded ? "← Profil" : "← Fil"} initialPeriod={openAsset.chart || "1y"} onBack={closeAssetDetail} />;
  }

  return (
    <div>
      {/* Encadré publier */}
      {!embedded && <div
        style={{ ...card, marginBottom: 16, ...(dragOver ? { borderColor: T.accent, background: T.accentBg } : {}) }}
        onDragOver={e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Avatar name={profile?.full_name} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              value={postInput}
              ref={textRef}
              onChange={e => { setPostInput(e.target.value); setCaret(e.target.selectionStart); if (postError) setPostError(""); }}
              onSelect={e => setCaret(e.target.selectionStart)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === "Escape" && tag) { e.preventDefault(); setDismissedTag(`${tag.start}${tag.sign}${tag.query}`); } }}
              onPaste={e => { const files = [...e.clipboardData.files].filter(isImage); if (files.length) { e.preventDefault(); addImages(files); } }}
              placeholder="Partage une pensée, une analyse… $ pour citer une valeur, @ pour un membre"
              maxLength={5000}
              style={{ width: "100%", background: "none", border: "none", outline: "none", color: T.text, fontFamily: "inherit", fontSize: 14, resize: "none", lineHeight: 1.5, minHeight: 60 }}
            />
            <TagSuggestions tag={tag} myId={userId} T={T} onPick={pickTag} />
            <ComposerPreviews items={postImages} onRemove={removeImage} T={T} />
            <ComposerFiles files={postFiles} onRemove={i => setPostFiles(p => p.filter((_, j) => j !== i))} T={T} />
            {postAsset && (
              <AttachedChip T={T} icon={postAsset.chart ? "📈" : "$"} onRemove={() => setPostAsset(null)}
                label={`${postAsset.name} (${postAsset.symbol})${postAsset.chart ? ` · graphique ${CHART_PERIODS.find(p => p.id === postAsset.chart)?.label}` : ""}`} />
            )}
            {postAllocation && (
              <AttachedChip T={T} icon="🥧" onRemove={() => setPostAllocation(null)}
                label={`Ma répartition ${postAllocation.mode === "positions" ? "par position" : "par classe d'actifs"} (${postAllocation.rows.length} lignes, en %)`} />
            )}
            {picker === "chart" && (
              <AssetPicker key={picker} T={T} onClose={() => setPicker(null)}
                onPick={a => { setPostAsset(a); setPicker(null); }} />
            )}
            {picker === "allocation" && (
              <AllocationPicker T={T} onClose={() => setPicker(null)} onPick={a => { setPostAllocation(a); setPicker(null); }} />
            )}
            {pollOptions && <PollEditor options={pollOptions} onOptions={setPollOptions} days={pollDays} onDays={setPollDays} onRemove={() => setPollOptions(null)} T={T} />}
            {preparing > 0 && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>Préparation de l'image…</div>}
            {postError && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{postError}</div>}
            <div className="composer-toolbar" style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.border}` }}>
              <input ref={fileInput} type="file" accept={ACCEPT_ATTR} multiple hidden
                onChange={e => { addImages(e.target.files); e.target.value = ""; }} />
              <button onClick={() => fileInput.current?.click()} disabled={postImages.length + preparing >= MAX_IMAGES} aria-label="Image"
                title={`Ajouter jusqu'à ${MAX_IMAGES} images`}
                style={{ ...toolBtn, opacity: postImages.length + preparing >= MAX_IMAGES ? 0.4 : 1 }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">🖼️</span><span className="tool-label">Image</span>
              </button>
              <input ref={docInput} type="file" accept={FILE_ACCEPT_ATTR} multiple hidden
                onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              <button onClick={() => docInput.current?.click()} disabled={postFiles.length >= MAX_FILES} aria-label="Fichier"
                title={`Joindre jusqu'à ${MAX_FILES} fichiers (PDF, Excel, CSV, Word, PowerPoint · 10 Mo max)`}
                style={{ ...toolBtn, opacity: postFiles.length >= MAX_FILES ? 0.4 : 1 }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">📎</span><span className="tool-label">Fichier</span>
              </button>
              <button onClick={() => setPollOptions(o => (o ? null : ["", ""]))} aria-pressed={!!pollOptions} aria-label="Sondage"
                title="Ajouter un sondage" style={{ ...toolBtn, ...(pollOptions ? { background: T.accentBg } : {}) }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">📊</span><span className="tool-label">Sondage</span>
              </button>
              <button onClick={() => setPicker(p => (p === "chart" ? null : "chart"))} aria-pressed={picker === "chart"} aria-label="Graphique" title="Joindre la courbe d'une valeur ou d'un indice"
                style={{ ...toolBtn, ...(picker === "chart" || postAsset?.chart ? { background: T.accentBg } : {}) }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">📈</span><span className="tool-label">Graphique</span>
              </button>
              <button onClick={() => setPicker(p => (p === "allocation" ? null : "allocation"))} aria-pressed={picker === "allocation"} aria-label="Répartition" title="Partager ta répartition, en % uniquement"
                style={{ ...toolBtn, ...(picker === "allocation" || postAllocation ? { background: T.accentBg } : {}) }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">🥧</span><span className="tool-label">Répartition</span>
              </button>
              <div style={{ flex: 1 }} />
              {hasContent && (
                <button className="composer-publish" onClick={publishPost} disabled={posting || preparing > 0} style={{ background: T.accent, border: "none", borderRadius: 999, padding: "6px 18px", fontSize: 13, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", opacity: preparing ? 0.6 : 1 }}>
                  {posting ? "Envoi…" : "Publier"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>}

      {/* Scope */}
      {!embedded && <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["amis", "👥 Amis"], ["verio", "🌍 Verio"]].map(([id, label]) => (
          <button key={id} onClick={() => { if (id !== scope) { setLoading(true); setScope(id); } }} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? T.accent : T.border}`, background: scope === id ? T.accentBg : "none", color: scope === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>}

      {/* Filtres */}
      {!embedded && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? T.accent : T.border}`, background: filter === f.id ? T.accentBg : "none", color: filter === f.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>}

      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>Chargement…</div>}

      {!loading && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>
            {embedded ? (only === "posts" ? "Aucun post pour le moment" : "Aucun mouvement pour le moment") : scope === "amis" && friendIds.length <= 1 ? "Ajoute des amis pour voir leurs investissements" : "Aucune activité dans cette catégorie"}
          </div>
          <div style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.6 }}>
            {embedded && only === "posts" ? "Ses publications apparaîtront ici" : !embedded && scope === "amis" && friendIds.length <= 1 ? "Va dans Explore pour trouver des investisseurs" : "Les mouvements apparaîtront ici automatiquement"}
          </div>
        </div>
      )}

      {visible.map(activity => {
        if (activity.kind === "club") {
          return (
            <ClubFeedCard key={`club-${activity.id}`} post={activity} T={T} card={card} btnAct={btnAct}
              onOpenClub={onOpenClub} onAsset={openAssetDetail} onProfile={id => onViewProfile && onViewProfile(id)} />
          );
        }
        const meta = activity.type === "post"
          ? { tag: "Post", tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: null, sub: null, stat: null }
          : getActivityMeta(activity);
        const isMe = activity.user_id === session.user.id;
        const activityComments = comments[activity.id] || [];
        const like = likes[activity.id] || { count: 0, mine: false };

        return (
          <div key={activity.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={activity.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(activity.user_id)}>
                  {activity.author?.full_name}
                  {isMe && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>· moi</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textFaint }}>{timeAgo(activity.created_at)}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.tag}</span>
            </div>

            {activity.type === "post" ? (
              <>
                {activity.data?.content && (
                  <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    <RichText text={activity.data.content} tickers={activity.data.tickers} mentions={activity.data.mentions} T={T}
                      onAsset={openAssetDetail} onProfile={id => onViewProfile && onViewProfile(id)} />
                  </div>
                )}
                <TickerChips tickers={activity.data?.tickers} T={T} onAsset={openAssetDetail} />
                {activity.data?.poll && (
                  <PollView poll={activity.data.poll} counts={polls.counts[activity.id]} myVote={polls.mine[activity.id]}
                    isAuthor={isMe} onVote={option => castVote(activity.id, option)} T={T} />
                )}
                {activity.data?.asset && <AssetCard asset={activity.data.asset} T={T} onOpen={openAssetDetail} />}
                {activity.data?.allocation && <AllocationCard allocation={activity.data.allocation} T={T} />}
                <PostImages images={activity.data?.images} T={T} />
                <PostFiles files={activity.data?.files} T={T} />
              </>
            ) : (
              <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.4 }}>{meta.title}</div>
                {meta.sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{meta.sub}</div>}
                {meta.stat && <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.stat}</span>}
              </div>
            )}
            {TRADE_TYPES.includes(activity.type) && (
              <MovementNote activity={activity} isMe={isMe} myId={userId} T={T}
                editing={noteEditing === activity.id} onEditingChange={on => setNoteEditing(on ? activity.id : null)}
                onSaved={updated => setActivities(list => list.map(a => (a.id === updated.id ? updated : a)))}
                onAsset={openAssetDetail} onProfile={id => onViewProfile && onViewProfile(id)} />
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => toggleLike(activity)} style={{ ...btnAct, ...(like.mine ? { borderColor: T.accent, color: T.accent } : {}) }}>
                👍 {like.mine ? "Liké" : "Like"}{like.count > 0 ? ` · ${like.count}` : ""}
              </button>
              <button onClick={() => toggleComment(activity.id)} style={btnAct}>
                💬 {activityComments.length > 0 ? activityComments.length : "Commenter"}
              </button>
              {isMe && TRADE_TYPES.includes(activity.type) && !activity.note && noteEditing !== activity.id && (
                <button onClick={() => setNoteEditing(activity.id)} title="Explique ce mouvement : ta stratégie, ton ressenti…"
                  style={{ ...btnAct, border: "none", color: T.textMuted }}>
                  ✏️ Ajouter une description
                </button>
              )}
              {isMe && activity.type === "post" && (
                confirmDelete === activity.id ? (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>Supprimer ce post ?</span>
                    <button onClick={() => deletePost(activity)} disabled={deleting} style={{ ...btnAct, borderColor: T.red, color: T.red }}>{deleting ? "…" : "Supprimer"}</button>
                    <button onClick={() => setConfirmDelete(null)} style={btnAct}>Annuler</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(activity.id)} title="Supprimer le post" aria-label="Supprimer le post" style={{ ...btnAct, marginLeft: "auto", border: "none" }}>🗑️</button>
                )
              )}
            </div>

            {openComment[activity.id] && (
              <div style={{ marginTop: 12, borderTop: `0.5px solid ${T.border}`, paddingTop: 10 }}>
                {activityComments.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Avatar name={c.author?.full_name} size={26} />
                    <div style={{ background: T.bgSubtle, borderRadius: 8, padding: "7px 10px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(c.user_id)}>{c.author?.full_name || "Investisseur"}</div>
                        <div style={{ fontSize: 11, color: T.textFaint, flex: 1 }}>{timeAgo(c.created_at)}</div>
                        {(c.user_id === userId || isMe) && (
                          <button onClick={() => deleteComment(activity.id, c.id)} title="Supprimer" style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: T.text, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        <RichText text={c.content} tickers={c.tags?.tickers} mentions={c.tags?.mentions} T={T} onAsset={openAssetDetail} onProfile={pid => onViewProfile && onViewProfile(pid)} />
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Avatar name={profile?.full_name} size={26} />
                  <TagField
                    as="input"
                    value={commentInputs[activity.id] || ""}
                    onValueChange={v => setCommentInputs(p => ({ ...p, [activity.id]: v }))}
                    tags={commentTags[activity.id]}
                    onTagsChange={t => setCommentTags(p => ({ ...p, [activity.id]: t }))}
                    onSubmit={() => addComment(activity)}
                    myId={userId}
                    T={T}
                    placeholder="Commenter… ($ valeur, @ membre)"
                    maxLength={1000}
                    style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }}
                  />
                  <button onClick={() => addComment(activity)} style={{ ...btnAct, padding: "7px 12px" }}>↵</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
