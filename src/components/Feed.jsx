import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T, T as TLive } from "../theme";
import { badgeFromData } from "../badges";
import { MOMENTS, MOMENT_TYPES, isMoment, momentSentence } from "../moments";
import { tradeTexts, tradeSource, TRADE_TYPES } from "../trades";
import MovementNote from "./MovementNote";
import ClubFeedCard from "./ClubFeedCard";
import { MAX_IMAGES, ACCEPT_ATTR, isImage, compressImage, uploadImages, removeImages, MAX_FILES, FILE_ACCEPT_ATTR, checkFile, uploadFiles, removeFiles } from "../media";
import { makePoll, isValidPoll, fetchPolls, vote, closeFinishedPolls } from "../polls";
import { PostImages, ComposerPreviews, PostFiles, ComposerFiles, PollEditor, PollView } from "./PostMedia";
import { AssetCard, AllocationCard, AssetPicker, AllocationPicker, AttachedChip } from "./PostAttachments";
import { CHART_PERIODS, resolveAsset } from "../attachments";
import { RichText, TickerChips, TagSuggestions, TagField } from "./PostText";
import { tagAtCaret, finalizeTags, hasHashtag } from "../tags";
import IndexDetail from "./IndexDetail";
import { detailFor } from "../indices";
import { fetchFollowedIds, fetchFollowedNews, quarterLabel } from "../superInvestors";
import { fetchCompanyNews, fetchFollowedAssets, setFollowingAsset } from "../assetFollows";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { t, LANG } from "../i18n";

// Actualités dans le fil (Super Investors et sociétés suivis) : 4 au plus, un titre une seule fois
const FEED_NEWS_MAX = 4;


function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return t("à l'instant");
  if (diff < 3600) return t("il y a {n} min", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("il y a {n}h", { n: Math.floor(diff / 3600) });
  return t("il y a {n} j", { n: Math.floor(diff / 86400) });
}

const BADGE_TYPES = ["badge"];
// Ce que montre le fil : posts, mouvements, moments et badges (pas les dividendes ni l'ajout d'un courtier)
const FEED_TYPES = ["post", ...TRADE_TYPES, ...MOMENT_TYPES, ...BADGE_TYPES];

function getActivityMeta(activity) {
  const d = activity.data || {};
  const name = activity.author?.full_name || t("Quelqu'un");
  const badge = badgeFromData(d);
  const trade = tradeTexts(activity.type, d);
  if (trade) {
    const up = activity.type === "renforcement";
    return { tag: { renforcement: t("Renforcement"), allegement: t("Allègement"), vente: t("Vente") }[activity.type], tagBg: up ? T.upBg : "rgba(240,153,123,0.1)", tagColor: up ? T.up : T.orange, title: `${name} ${trade.sentence}`, sub: trade.detail, stat: trade.stat };
  }
  if (isMoment(activity.type)) {
    const m = MOMENTS[activity.type];
    return { tag: m.tag, tagBg: "rgba(240,215,0,0.1)", tagColor: T.gold, title: momentSentence(activity.type, d, name), sub: m.sub?.(d) || "", stat: m.stat?.(d) || "" };
  }
  const map = {
    declaration_13f: { tag: t("Déclaration 13F"), tagBg: "rgba(240,215,0,0.1)", tagColor: T.gold, title: t("{name} a publié ses mouvements du {quarter}", { name, quarter: quarterLabel(d.period) }), sub: d.positions ? t("{n} positions en portefeuille", { n: d.positions }) : "", stat: "" },
    new_position: { tag: t("Nouvelle position"), tagBg: "rgba(123,184,240,0.1)", tagColor: T.blue, title: t("{name} a ajouté une nouvelle position", { name }), sub: d.label, stat: `${d.exposition || d.vehicule || ""}${d.broker ? ` · ${d.broker}` : ""}${d.percentage ? ` · ${d.percentage}%` : ""}` },
    renforcement: { tag: t("Renforcement"), tagBg: T.upBg, tagColor: T.up, title: t("{name} a renforcé une position", { name }), sub: d.label, stat: "" },
    vente: { tag: t("Vente"), tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: t("{name} a vendu une position", { name }), sub: d.label, stat: "" },
    allegement: { tag: t("Allègement"), tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: t("{name} a allégé une position", { name }), sub: d.label, stat: "" },
    dividende: { tag: t("Dividende"), tagIcon: "coins", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: t("{name} a reçu un dividende", { name }), sub: d.label, stat: "" },
    coupon: { tag: t("Coupon"), tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: t("{name} a reçu un coupon", { name }), sub: d.label, stat: "" },
    versement: { tag: t("Versement"), tagBg: T.upBg, tagColor: T.up, title: t("{name} a effectué un versement", { name }), sub: d.broker, stat: "" },
    retrait: { tag: t("Retrait"), tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: t("{name} a effectué un retrait", { name }), sub: d.broker, stat: "" },
    rebalancement: { tag: t("Rééquilibrage"), tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: t("{name} a rééquilibré son portefeuille", { name }), sub: "", stat: "" },
    suppression_position: { tag: t("Position supprimée"), tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: t("{name} a supprimé une position", { name }), sub: d.label, stat: "" },
    new_broker: { tag: t("Nouveau broker"), tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: t("{name} a ajouté un broker", { name }), sub: d.broker, stat: "" },
    badge: { tag: t("Badge"), tagIcon: "award", tagBg: "rgba(240,215,0,0.08)", tagColor: T.gold, title: t("{name} a débloqué un badge", { name }), sub: badge.category, stat: `${badge.medal} ${badge.name}` },
  };
  return map[activity.type] || { tag: t("Activité"), tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: t("{name} a eu une activité", { name }), sub: "", stat: "" };
}

// Posts : ce que les membres écrivent · Activité : les mouvements (factuels)
// Moments : moments automatiques et badges
const FILTERS = [
  { id: "all", label: t("Tout") },
  { id: "posts", label: t("Posts") },
  { id: "activite", label: t("Activité") },
  { id: "moments", label: t("Moments") },
];

const NEWS_COMMENT_COLUMNS = "id, url, user_id, content, tags, created_at, author:profiles!news_comments_user_id_fkey(full_name, username)";
const COMMENT_COLUMNS = "id, activity_id, user_id, content, tags, created_at, author:profiles!activity_comments_user_id_fkey(full_name, username)";

// Amis acceptés (moi inclus), activités à afficher selon le périmètre, avec leurs likes et commentaires
// Titre d'un mouvement : le nom de la valeur (« Total Energies ») y est cliquable et ouvre sa fiche
function MovementTitle({ meta, label, lookup, onOpenLabel, T }) {
  const link = (
    <button onClick={() => onOpenLabel(label)} title={t("Voir le cours de {label}", { label })}
      style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 600, textDecoration: "underline", textDecorationColor: T.borderStrong, textUnderlineOffset: 3, cursor: "pointer" }}>
      {label}
    </button>
  );
  const title = meta.title || "";
  const at = label ? title.indexOf(label) : -1;
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.4 }}>
        {at >= 0 ? <>{title.slice(0, at)}{link}{title.slice(at + label.length)}</> : title}
      </div>
      {meta.sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{at < 0 && label && meta.sub === label ? link : meta.sub}</div>}
      {lookup && (
        <div role={lookup.error ? "alert" : "status"} style={{ fontSize: 12, color: lookup.error ? T.red : T.textFaint, marginTop: 4 }}>{lookup.error || t("Recherche du cours…")}</div>
      )}
    </>
  );
}

// Mouvements du trimestre d'un Super Investor (carte « Déclaration 13F ») : repliée, un
// résumé (« 3 nouvelles · 8 renforcements… ») et les 3 plus gros mouvements sur une ligne
// chacun ; dépliée, tous les mouvements avec leur détail. Chaque valeur ouvre sa fiche.
const DECL_MOVES = {
  new: { label: t("Nouvelle position"), short: t("Nouvelle"), count: n => (n > 1 ? t("{n} nouvelles", { n }) : t("{n} nouvelle", { n })), up: true },
  up: { label: t("Renforcement"), short: t("Renfort"), count: n => (n > 1 ? t("{n} renforcements", { n }) : t("{n} renforcement", { n })), up: true },
  down: { label: t("Allègement"), short: t("Allègement"), count: n => (n > 1 ? t("{n} allègements", { n }) : t("{n} allègement", { n })), up: false },
  sold: { label: t("Vente totale"), short: t("Vente"), count: n => (n > 1 ? t("{n} ventes", { n }) : t("{n} vente", { n })), up: false },
};
const fmtNum = n => { const s = String(Math.round(Number(n) * 10) / 10); return LANG === "en" ? s : s.replace(".", ","); };
const fmtPctFr = n => t("{n} %", { n: fmtNum(n) });

function DeclarationMoves({ data, T, onOpenLabel }) {
  const [open, setOpen] = useState(false);
  const moves = data?.moves || [];
  if (!moves.length) return null;
  // Les 3 mouvements qui pèsent le plus (écart de % du portefeuille)
  const top = [...moves].sort((a, b) => Math.abs(b.apres - b.avant) - Math.abs(a.apres - a.avant)).slice(0, 3);
  const counts = Object.entries(DECL_MOVES)
    .map(([type, meta]) => [meta, moves.filter(m => m.type === type).length])
    .filter(([, n]) => n > 0);
  const nameBtn = label => (
    <button onClick={() => onOpenLabel(label)} title={t("Voir le cours de {label}", { label })}
      style={{ display: "block", maxWidth: "100%", background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: T.text, textAlign: "left", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
  const toggle = (
    <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", padding: "6px 0 0", fontSize: 12, fontWeight: 600, color: T.accent, cursor: "pointer", fontFamily: "inherit" }}>
      {open ? t("Réduire") : t("Voir les {n} mouvements", { n: moves.length })}
    </button>
  );

  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
          {counts.map(([meta, n]) => meta.count(n)).join(" · ")}
        </div>
        {top.map((m, i) => {
          const meta = DECL_MOVES[m.type] || DECL_MOVES.up;
          return (
            <div key={`${m.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ flex: 1, minWidth: 0 }}>{nameBtn(m.label)}</span>
              <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>{meta.short}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: meta.up ? T.up : T.orange, flexShrink: 0, minWidth: 74, textAlign: "right" }}>{fmtNum(m.avant)} → {fmtPctFr(m.apres)}</span>
            </div>
          );
        })}
        {moves.length > top.length && toggle}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {moves.map((m, i) => {
        const meta = DECL_MOVES[m.type] || DECL_MOVES.up;
        const color = meta.up ? T.up : T.orange;
        return (
          <div key={`${m.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {nameBtn(m.label)}
              <span style={{ fontSize: 11, color: T.textFaint }}>{meta.label}{m.variation != null && (m.type === "up" || m.type === "down") ? ` · ${t("{n} % d'actions", { n: `${m.variation > 0 ? "+" : ""}${m.variation}` })}` : ""}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{fmtPctFr(m.avant)} → {fmtPctFr(m.apres)}</span>
          </div>
        );
      })}
      {toggle}
      {data.moves_total > moves.length && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{t("+ {n} petits mouvements non affichés", { n: data.moves_total - moves.length })}</div>}
    </div>
  );
}

// Article de presse sur un Super Investor ou une société suivis : titre, journal, date ;
// s'ouvre sur le site du journal. L'icône et le nom ouvrent le profil ou la fiche.
function NewsFeedCard({ item, T, card, onProfile, onAsset, like, onLike, btnAct, commentCount, onToggleComments, comments }) {
  const { article, investor, company } = item;
  const who = investor
    ? { icon: investor.icon, name: investor.name, title: t("Voir le profil de {name}", { name: investor.name }), open: () => onProfile(investor.id) }
    : { icon: company.type === "Indice" ? "📈" : "🏢", name: company.name, title: t("Voir la fiche de {name}", { name: company.name }), open: () => onAsset(company) };
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={who.open} title={who.title}
          style={{ width: 36, height: 36, borderRadius: 10, background: T.bgSubtle, border: "none", fontSize: 18, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.textMuted }}>{company && !investor ? <Icon emoji={who.icon} size={18} /> : who.icon}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={who.open} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer", textAlign: "left" }}>{who.name}</button>
          <div style={{ fontSize: 11, color: T.textFaint }}>{timeAgo(item.created_at)}</div>
        </div>
        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: T.bgSubtle, color: T.textMuted, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="news" size={12} />{t("Actualité")}</span>
      </div>
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${T.border}`, background: T.bgSubtle, textDecoration: "none" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{article.title}</div>
        {article.source && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>{article.source}</div>}
      </a>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onLike} style={{ ...btnAct, ...(like.mine ? { borderColor: T.accent, color: T.accent } : {}) }}>
          <Icon name="like" size={14} />{like.mine ? t("Liké") : t("Like")}{like.count > 0 ? ` · ${like.count}` : ""}
        </button>
        <button onClick={onToggleComments} style={btnAct}><Icon name="comment" size={14} />{commentCount > 0 ? commentCount : t("Commenter")}</button>
      </div>
      {comments}
    </div>
  );
}

// Posts récents des clubs dont je suis membre (affichés dans le fil, avec « Tout » et « Posts »)
async function fetchMyClubPosts(userId, hashtag = null) {
  const { data: memberships } = await supabase.from("club_members").select("club_id").eq("user_id", userId);
  const clubIds = (memberships || []).map(m => m.club_id);
  if (clubIds.length === 0) return [];
  let query = supabase.from("club_posts")
    .select("*, author:profiles!club_posts_user_id_fkey(full_name, username), club:clubs(*)")
    .in("club_id", clubIds).order("created_at", { ascending: false }).limit(50);
  if (hashtag) query = query.ilike("content", `%#${hashtag}%`);
  const { data } = await query;
  const posts = (data || []).filter(p => !hashtag || hasHashtag(p.content, hashtag));
  // Nombre de réponses et réactions de chaque post, en une requête chacune
  if (posts.length) {
    const ids = posts.map(p => p.id);
    const [{ data: replies }, { data: reactions }] = await Promise.all([
      supabase.from("club_replies").select("post_id").in("post_id", ids),
      supabase.from("club_reactions").select("id, post_id, user_id, type").in("post_id", ids),
    ]);
    const counts = {}, byPost = {};
    for (const r of replies || []) counts[r.post_id] = (counts[r.post_id] || 0) + 1;
    for (const r of reactions || []) (byPost[r.post_id] ||= []).push(r);
    for (const p of posts) { p.reply_count = counts[p.id] || 0; p.reactions = byPost[p.id] || []; }
  }
  return posts.map(p => ({ ...p, kind: "club" }));
}

// « onlyUserId » : seulement les activités de ce membre, des types « onlyTypes »
// (onglets Activité et Posts d'un profil public)
// « hashtag » : les posts qui contiennent ce hashtag (page Explore), dans tout Verio et mes clubs
// « focusId » : une seule activité (ouverte depuis une notification)
async function fetchFeed(userId, scope, onlyUserId = null, onlyTypes = TRADE_TYPES, hashtag = null, focusId = null) {
  closeFinishedPolls();
  const { data: friendships } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  const ids = [userId];
  if (friendships) friendships.forEach(f => {
    if (f.requester_id !== userId) ids.push(f.requester_id);
    if (f.receiver_id !== userId) ids.push(f.receiver_id);
  });
  // Super Investors que je suis : leurs déclarations arrivent dans mon fil comme celles d'un ami
  const followed = !onlyUserId && !focusId && !hashtag ? await fetchFollowedIds(userId).catch(() => []) : [];
  let query = supabase.from("activities").select("*, author:profiles!activities_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(100);
  if (focusId) query = query.eq("id", focusId);
  else if (hashtag) query = query.eq("type", "post").ilike("data->>content", `%#${hashtag}%`);
  else if (onlyUserId) query = query.eq("user_id", onlyUserId).in("type", onlyTypes);
  else {
    query = query.in("type", FEED_TYPES);
    if (scope === "amis") query = query.in("user_id", [...ids, ...followed]);
    // « Mes valeurs » : les posts qui citent une de mes valeurs (filtrés plus bas)
    if (scope === "valeurs") query = query.eq("type", "post");
  }
  const { data } = await query;
  const mine = scope === "valeurs" && !onlyUserId && !focusId && !hashtag ? await fetchFollowedAssets(userId).catch(() => []) : [];
  const mySymbols = new Set(mine.map(a => a.symbol));
  // « #dividende » ne doit pas ramener « #dividendes »
  const activities = (data || [])
    .filter(a => !hashtag || hasHashtag(a.data?.content, hashtag))
    .filter(a => scope !== "valeurs" || onlyUserId || focusId || hashtag || (a.data?.tickers || []).some(t => mySymbols.has(t.symbol)));

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
  const [polls, clubPosts, news] = await Promise.all([
    fetchPolls(pollIds, userId),
    (onlyUserId || focusId || scope === "valeurs") ? [] : fetchMyClubPosts(userId, hashtag),
    // « Mes valeurs » : l'actualité de chaque société et indice suivis (3 articles sur 7 jours)
    // Ailleurs : un peu d'actualité des Légendes et des sociétés suivies
    onlyUserId || focusId || hashtag ? [] : scope === "valeurs"
      ? fetchCompanyNews(userId, { perAsset: 3, days: 7, assets: mine }).then(list => list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at)).slice(0, 40)).catch(() => [])
      : Promise.all([
      followed.length ? fetchFollowedNews(userId).catch(() => []) : [],
      fetchCompanyNews(userId).catch(() => []),
    ]).then(([a, b]) => {
      const seen = new Set();
      return [...a, ...b]
        .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
        .filter(n => !seen.has(n.article.title) && seen.add(n.article.title))
        .slice(0, FEED_NEWS_MAX);
    }),
  ]);
  // Likes et commentaires des actualités affichées (par adresse de l'article)
  const newsLikes = {}, newsComments = {};
  if (news.length) {
    const urls = news.map(n => n.article.url);
    const [{ data: rows }, { data: commentRows }] = await Promise.all([
      supabase.from("news_likes").select("url, user_id").in("url", urls),
      supabase.from("news_comments").select(NEWS_COMMENT_COLUMNS).in("url", urls).order("created_at"),
    ]);
    for (const c of commentRows || []) (newsComments[c.url] ||= []).push(c);
    for (const l of rows || []) {
      const entry = newsLikes[l.url] ||= { count: 0, mine: false };
      entry.count++;
      if (l.user_id === userId) entry.mine = true;
    }
  }
  return { ids, activities, likes, comments, polls, newsLikes, newsComments, followedAssets: mine, clubPosts: [...clubPosts, ...news] };
}

// « onlyUserId » : version intégrée au profil public — mêmes cartes que le fil, limitées à ce
// membre, sans encadré de publication, choix Découvrir / Mon fil ni filtres.
// « only » : "trades" (onglet Activité, mouvements) ou "posts" (onglet Posts).
// « hashtag » : page Explore d'un hashtag — ses posts (Verio et mes clubs), sans encadré ni filtres.
// « focusId » : une seule activité, commentaires ouverts (clic sur une notification).
export default function Feed({ session, T: TProp, onViewProfile, onlyUserId = null, only = "trades", onOpenClub, hashtag = null, focusId = null }) {
  const embedded = !!onlyUserId || !!hashtag || focusId != null;
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const toolBtn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 34, minHeight: 36, background: "none", border: "none", borderRadius: 8, padding: "5px 6px", fontSize: 13, fontWeight: 600, color: T.purple, cursor: "pointer", fontFamily: "inherit" };
  const btnAct = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 };

  const [activities, setActivities] = useState([]);
  const [clubPosts, setClubPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  // « Découvrir » (tout Verio) par défaut tant que l'application compte peu de membres
  const [scope, setScope] = useState("verio");
  const [friendIds, setFriendIds] = useState([]);
  const [likes, setLikes] = useState({});
  const [newsLikes, setNewsLikes] = useState({}); // likes des actualités, par adresse de l'article
  const [newsComments, setNewsComments] = useState({}); // commentaires des actualités, par adresse
  const [followedAssets, setFollowedAssets] = useState([]); // onglet « Mes valeurs »
  const [comments, setComments] = useState({});
  const [openComment, setOpenComment] = useState(() => (focusId != null ? { [focusId]: true } : {}));
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
  const [postEdit, setPostEdit] = useState(null);             // { id, text, tags, saving, error } : post en cours de modification
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
    fetchFeed(userId, scope, onlyUserId, only === "posts" ? ["post"] : TRADE_TYPES, hashtag, focusId).then(({ ids, activities, likes, comments, polls, newsLikes, newsComments, followedAssets, clubPosts }) => {
      if (ignore) return;
      setFollowedAssets(followedAssets);
      setNewsLikes(newsLikes);
      setNewsComments(newsComments);
      setClubPosts(clubPosts);
      setPolls(polls);
      setFriendIds(ids);
      setActivities(activities);
      setLikes(likes);
      setComments(comments);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [userId, scope, reloadKey, onlyUserId, only, hashtag, focusId]);

  // Images choisies (bouton, coller ou glisser-déposer) : compressées tout de suite pour l'aperçu
  async function addImages(fileList) {
    const files = [...(fileList || [])].filter(isImage);
    if (files.length === 0) return;
    setPostError("");
    const room = MAX_IMAGES - postImages.length - preparing;
    if (room <= 0) { setPostError(t("{n} images maximum par post.", { n: MAX_IMAGES })); return; }
    if (files.length > room) setPostError(t("{n} images maximum par post.", { n: MAX_IMAGES }));
    const batch = files.slice(0, room);
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
    if (ok.length > room) setPostError(t("{n} fichiers maximum par post.", { n: MAX_FILES }));
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

  // Nom d'une valeur dans un mouvement (« Total Energies ») : retrouve la valeur cotée et ouvre sa fiche
  const [labelLookup, setLabelLookup] = useState(null); // { id, error }
  async function openLabel(activityId, label) {
    setLabelLookup({ id: activityId, error: null });
    const asset = await resolveAsset({ label });
    if (!asset) { setLabelLookup({ id: activityId, error: t("Cours introuvable pour « {label} ».", { label }) }); return; }
    setLabelLookup(null);
    openAssetDetail({ ...asset, name: label });
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
    if (poll && !isValidPoll(poll)) { setPostError(t("Un sondage a besoin d'au moins 2 choix.")); return; }
    if (poll && !content) { setPostError(t("Écris la question du sondage dans le texte du post.")); return; }
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
      setPostError(t("Publication impossible. Réessaie."));
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

  // Modifier son post : seul le texte (et ses $valeurs / @membres) change
  async function savePostEdit(activity) {
    const text = postEdit.text.trim();
    const tags = finalizeTags(text, postEdit.tags);
    setPostEdit(e => ({ ...e, saving: true, error: "" }));
    const { data, error } = await supabase.rpc("update_my_post", { activity: String(activity.id), content: text, tickers: tags?.tickers || null, mentions: tags?.mentions || null });
    if (error || !data) { setPostEdit(e => ({ ...e, saving: false, error: t("Modification impossible. Réessaie.") })); return; }
    setActivities(list => list.map(a => (a.id === activity.id ? { ...a, data } : a)));
    setPostEdit(null);
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

  // Like d'une actualité : affiché tout de suite, annulé si Supabase refuse
  async function toggleNewsLike(url) {
    const key = `news:${url}`;
    if (likePending.current.has(key)) return;
    likePending.current.add(key);
    const current = newsLikes[url] || { count: 0, mine: false };
    setNewsLikes(p => ({ ...p, [url]: { count: current.count + (current.mine ? -1 : 1), mine: !current.mine } }));
    const { error } = current.mine
      ? await supabase.from("news_likes").delete().eq("url", url).eq("user_id", userId)
      : await supabase.from("news_likes").insert({ url, user_id: userId });
    likePending.current.delete(key);
    if (error) setNewsLikes(p => ({ ...p, [url]: current }));
  }

  // Commentaires sous une actualité (clé « news:<adresse> » pour la zone de saisie)
  async function addNewsComment(url) {
    const key = `news:${url}`;
    const text = (commentInputs[key] || "").trim();
    if (!text) return;
    const tags = finalizeTags(text, commentTags[key]);
    setCommentInputs(p => ({ ...p, [key]: "" }));
    const row = { url, user_id: userId, content: text };
    if (tags) row.tags = tags;
    const { data, error } = await supabase.from("news_comments").insert(row).select(NEWS_COMMENT_COLUMNS).single();
    if (error) { setCommentInputs(p => ({ ...p, [key]: text })); return; }
    setCommentTags(p => ({ ...p, [key]: null }));
    setNewsComments(p => ({ ...p, [url]: [...(p[url] || []), data] }));
    for (const m of tags?.mentions || []) if (m.id !== userId) notify(m.id, "mention", { excerpt: text.slice(0, 80) });
  }

  async function deleteNewsComment(url, id) {
    const { error } = await supabase.from("news_comments").delete().eq("id", id);
    if (!error) setNewsComments(p => ({ ...p, [url]: (p[url] || []).filter(c => c.id !== id) }));
  }

  // Zone de commentaires (liste + saisie), partagée par les posts / mouvements et les actualités
  function renderComments({ list, inputKey, onAdd, onDelete, canDeleteAll }) {
    return (
      <div style={{ marginTop: 12, borderTop: `0.5px solid ${T.border}`, paddingTop: 10 }}>
        {list.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Avatar userId={c.user_id} name={c.author?.full_name} size={26} />
            <div style={{ background: T.bgSubtle, borderRadius: 8, padding: "7px 10px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(c.user_id)}>
                  {c.author?.full_name || t("Investisseur")}
                  {c.author?.username && <span style={{ fontWeight: 400, color: T.textFaint, marginLeft: 5 }}>@{c.author.username}</span>}
                </div>
                <div style={{ fontSize: 11, color: T.textFaint, flex: 1 }}>{timeAgo(c.created_at)}</div>
                {(c.user_id === userId || canDeleteAll) && (
                  <button onClick={() => onDelete(c.id)} title={t("Supprimer")} aria-label={t("Supprimer le commentaire")} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, padding: 0, display: "inline-flex", alignItems: "center" }}><Icon name="close" size={12} /></button>
                )}
              </div>
              <div style={{ fontSize: 13, color: T.text, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <RichText text={c.content} tickers={c.tags?.tickers} mentions={c.tags?.mentions} T={T} onAsset={openAssetDetail} onProfile={pid => onViewProfile && onViewProfile(pid)} />
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Avatar userId={userId} name={profile?.full_name} size={26} />
          <TagField
            as="input"
            value={commentInputs[inputKey] || ""}
            onValueChange={v => setCommentInputs(p => ({ ...p, [inputKey]: v }))}
            tags={commentTags[inputKey]}
            onTagsChange={t => setCommentTags(p => ({ ...p, [inputKey]: t }))}
            onSubmit={onAdd}
            myId={userId}
            T={T}
            placeholder={t("Commenter… ($ valeur, @ membre)")}
            maxLength={1000}
            style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }}
          />
          <button onMouseDown={e => e.preventDefault()} onClick={onAdd} aria-label={t("Envoyer le commentaire")} title={t("Envoyer")} style={{ ...btnAct, padding: "7px 12px" }}><Icon name="enter" size={14} /></button>
        </div>
      </div>
    );
  }

  // Like (réaction 👍) d'un post de club affiché dans le fil, comme dans le club
  async function toggleClubLike(post) {
    const key = `club:${post.id}`;
    if (likePending.current.has(key)) return;
    likePending.current.add(key);
    const mine = (post.reactions || []).find(r => r.user_id === userId && r.type === "👍");
    const setReactions = fn => setClubPosts(list => list.map(p => (p.kind === "club" && p.id === post.id ? { ...p, reactions: fn(p.reactions || []) } : p)));
    if (mine) {
      setReactions(rs => rs.filter(r => r !== mine));
      const { error } = await supabase.from("club_reactions").delete().eq("id", mine.id);
      if (error) setReactions(rs => [...rs, mine]);
    } else {
      const temp = { id: `tmp-${post.id}`, post_id: post.id, user_id: userId, type: "👍" };
      setReactions(rs => [...rs, temp]);
      const { data, error } = await supabase.from("club_reactions").insert({ post_id: post.id, user_id: userId, type: "👍" }).select("id, post_id, user_id, type").single();
      if (error) setReactions(rs => rs.filter(r => r !== temp));
      else {
        setReactions(rs => rs.map(r => (r === temp ? data : r)));
        if (post.user_id !== userId) notify(post.user_id, "post_reaction", { reaction: "👍", post_id: post.id });
      }
    }
    likePending.current.delete(key);
  }

  // Ne plus suivre une société depuis « Mes valeurs » (elle ne sera pas resuivie automatiquement)
  async function unfollowAsset(asset) {
    setFollowedAssets(list => list.filter(a => a.symbol !== asset.symbol));
    setClubPosts(list => list.filter(p => p.kind !== "news" || p.company?.symbol !== asset.symbol));
    if (!(await setFollowingAsset(userId, asset, false))) setReloadKey(k => k + 1);
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

  // « Tout » : posts et mouvements ; moments et badges restent dans le filtre « Moments »
  const visibleActivities = activities.filter(a => {
    if (filter === "all") return !MOMENT_TYPES.includes(a.type) && !BADGE_TYPES.includes(a.type);
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
    return <IndexDetail index={detailFor(openAsset)} T={T} backLabel={embedded ? t("← Profil") : t("← Fil")} initialPeriod={openAsset.chart || "1y"} onBack={closeAssetDetail} />;
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
          <Avatar userId={userId} name={profile?.full_name} size={36} />
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
              placeholder={t("Partage une pensée, une analyse… $ pour citer une valeur, @ pour un membre")}
              maxLength={5000}
              style={{ width: "100%", background: "none", border: "none", outline: "none", color: T.text, fontFamily: "inherit", fontSize: 14, resize: "none", lineHeight: 1.5, minHeight: 60 }}
            />
            <TagSuggestions tag={tag} myId={userId} T={T} onPick={pickTag} />
            <ComposerPreviews items={postImages} onRemove={removeImage} T={T} />
            <ComposerFiles files={postFiles} onRemove={i => setPostFiles(p => p.filter((_, j) => j !== i))} T={T} />
            {postAsset && (
              <AttachedChip T={T} icon={postAsset.chart ? <Icon name="up" size={14} /> : "$"} onRemove={() => setPostAsset(null)}
                label={`${postAsset.name} (${postAsset.symbol})${postAsset.chart ? ` · ${t("graphique {period}", { period: CHART_PERIODS.find(p => p.id === postAsset.chart)?.label })}` : ""}`} />
            )}
            {postAllocation && (
              <AttachedChip T={T} icon={<Icon name="pie" size={14} />} onRemove={() => setPostAllocation(null)}
                label={postAllocation.mode === "positions" ? t("Ma répartition par position ({n} lignes, en %)", { n: postAllocation.rows.length }) : t("Ma répartition par classe d'actifs ({n} lignes, en %)", { n: postAllocation.rows.length })} />
            )}
            {picker === "chart" && (
              <AssetPicker key={picker} T={T} onClose={() => setPicker(null)}
                onPick={a => { setPostAsset(a); setPicker(null); }} />
            )}
            {picker === "allocation" && (
              <AllocationPicker T={T} onClose={() => setPicker(null)} onPick={a => { setPostAllocation(a); setPicker(null); }} />
            )}
            {pollOptions && <PollEditor options={pollOptions} onOptions={setPollOptions} days={pollDays} onDays={setPollDays} onRemove={() => setPollOptions(null)} T={T} />}
            {preparing > 0 && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>{t("Préparation de l'image…")}</div>}
            {postError && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{postError}</div>}
            <div className="composer-toolbar" style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.border}` }}>
              <input ref={fileInput} type="file" accept={ACCEPT_ATTR} multiple hidden
                onChange={e => { addImages(e.target.files); e.target.value = ""; }} />
              <button onClick={() => fileInput.current?.click()} disabled={postImages.length + preparing >= MAX_IMAGES} aria-label={t("Image")}
                title={t("Ajouter jusqu'à {n} images", { n: MAX_IMAGES })}
                style={{ ...toolBtn, opacity: postImages.length + preparing >= MAX_IMAGES ? 0.4 : 1 }}>
                <Icon name="image" size={18} /><span className="tool-label">{t("Image")}</span>
              </button>
              <input ref={docInput} type="file" accept={FILE_ACCEPT_ATTR} multiple hidden
                onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              <button onClick={() => docInput.current?.click()} disabled={postFiles.length >= MAX_FILES} aria-label={t("Fichier")}
                title={t("Joindre jusqu'à {n} fichiers (PDF, Excel, CSV, Word, PowerPoint · 10 Mo max)", { n: MAX_FILES })}
                style={{ ...toolBtn, opacity: postFiles.length >= MAX_FILES ? 0.4 : 1 }}>
                <Icon name="clip" size={18} /><span className="tool-label">{t("Fichier")}</span>
              </button>
              <button onClick={() => setPollOptions(o => (o ? null : ["", ""]))} aria-pressed={!!pollOptions} aria-label={t("Sondage")}
                title={t("Ajouter un sondage")} style={{ ...toolBtn, ...(pollOptions ? { background: T.accentBg } : {}) }}>
                <Icon name="chart" size={18} /><span className="tool-label">{t("Sondage")}</span>
              </button>
              <button onClick={() => setPicker(p => (p === "chart" ? null : "chart"))} aria-pressed={picker === "chart"} aria-label={t("Graphique")} title={t("Joindre la courbe d'une valeur ou d'un indice")}
                style={{ ...toolBtn, ...(picker === "chart" || postAsset?.chart ? { background: T.accentBg } : {}) }}>
                <Icon name="up" size={18} /><span className="tool-label">{t("Graphique")}</span>
              </button>
              <button onClick={() => setPicker(p => (p === "allocation" ? null : "allocation"))} aria-pressed={picker === "allocation"} aria-label={t("Répartition")} title={t("Partager ta répartition, en % uniquement")}
                style={{ ...toolBtn, ...(picker === "allocation" || postAllocation ? { background: T.accentBg } : {}) }}>
                <Icon name="pie" size={18} /><span className="tool-label">{t("Répartition")}</span>
              </button>
              <div style={{ flex: 1 }} />
              {hasContent && (
                <button className="composer-publish" onClick={publishPost} disabled={posting || preparing > 0} style={{ background: T.accent, border: "none", borderRadius: 999, padding: "6px 18px", fontSize: 13, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", opacity: preparing ? 0.6 : 1 }}>
                  {posting ? t("Envoi…") : t("Publier")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>}

      {/* Scope */}
      {!embedded && <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["verio", t("Découvrir"), "flame"], ["amis", t("Mon fil"), "pin"], ["valeurs", t("Mes valeurs"), "building"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => { if (id !== scope) { setLoading(true); setScope(id); } }} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? T.accent : T.border}`, background: scope === id ? T.accentBg : "none", color: scope === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>}

      {/* Mes valeurs : sociétés et indices suivis (croix pour ne plus suivre) */}
      {!embedded && scope === "valeurs" && !loading && (
        <div style={{ ...card, padding: "0.9rem 1rem" }}>
          <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{t("Sociétés et indices suivis")}</div>
          {followedAssets.length === 0
            ? <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{t("Les actions de ton portefeuille sont suivies automatiquement. Tu peux aussi suivre une société ou un indice depuis sa fiche.")}</div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {followedAssets.map(a => (
                  <span key={a.symbol} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, border: `0.5px solid ${T.border}`, background: T.bgSubtle, fontSize: 12 }}>
                    <button onClick={() => openAssetDetail(a)} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: T.text, cursor: "pointer" }}>{a.name}</button>
                    {a.auto && <span title={t("Suivie automatiquement : elle est dans ton portefeuille")} style={{ fontSize: 10, color: T.textFaint }}>{t("portefeuille")}</span>}
                    <button onClick={() => unfollowAsset(a)} aria-label={t("Ne plus suivre {name}", { name: a.name })} title={t("Ne plus suivre")}
                      style={{ width: 18, height: 18, borderRadius: "50%", border: "none", background: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={12} /></button>
                  </span>
                ))}
              </div>}
        </div>
      )}

      {/* Filtres */}
      {!embedded && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? T.accent : T.border}`, background: filter === f.id ? T.accentBg : "none", color: filter === f.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>}

      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Chargement…")}</div>}

      {!loading && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ marginBottom: 12, color: T.textFaint, display: "flex", justifyContent: "center" }}><Icon name="users" size={32} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>
            {focusId != null ? t("Ce post n'existe plus") : hashtag ? t("Aucun post avec #{hashtag} pour le moment", { hashtag }) : embedded ? (only === "posts" ? t("Aucun post pour le moment") : t("Aucun mouvement pour le moment")) : scope === "amis" && friendIds.length <= 1 ? t("Ajoute des amis pour voir leurs investissements") : t("Aucune activité dans cette catégorie")}
          </div>
          <div style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.6 }}>
            {hashtag ? t("Ajoute ce hashtag à un post pour lancer le sujet") : embedded && only === "posts" ? t("Ses publications apparaîtront ici") : !embedded && scope === "amis" && friendIds.length <= 1 ? t("Va dans Explore pour trouver des investisseurs") : t("Les mouvements apparaîtront ici automatiquement")}
          </div>
        </div>
      )}

      {visible.map(activity => {
        if (activity.kind === "news") {
          return <NewsFeedCard key={`news-${activity.id}`} item={activity} T={T} card={card} btnAct={btnAct} onProfile={id => onViewProfile && onViewProfile(id)} onAsset={openAssetDetail}
            like={newsLikes[activity.article.url] || { count: 0, mine: false }} onLike={() => toggleNewsLike(activity.article.url)}
            commentCount={(newsComments[activity.article.url] || []).length}
            onToggleComments={() => toggleComment(`news:${activity.article.url}`)}
            comments={openComment[`news:${activity.article.url}`] && renderComments({
              list: newsComments[activity.article.url] || [], inputKey: `news:${activity.article.url}`,
              onAdd: () => addNewsComment(activity.article.url), onDelete: id => deleteNewsComment(activity.article.url, id),
            })} />;
        }
        if (activity.kind === "club") {
          return (
            <ClubFeedCard key={`club-${activity.id}`} post={activity} T={T} card={card} btnAct={btnAct} myId={userId} onLike={() => toggleClubLike(activity)}
              onOpenClub={onOpenClub} onAsset={openAssetDetail} onProfile={id => onViewProfile && onViewProfile(id)} />
          );
        }
        const meta = activity.type === "post"
          ? { tag: t("Post"), tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: null, sub: null, stat: null }
          : getActivityMeta(activity);
        const isMe = activity.user_id === session.user.id;
        const activityComments = comments[activity.id] || [];
        const like = likes[activity.id] || { count: 0, mine: false };

        return (
          <div key={activity.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar userId={activity.user_id} name={activity.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(activity.user_id)}>
                  {activity.author?.full_name}
                  {activity.author?.username && <span style={{ fontSize: 12, fontWeight: 400, color: T.textFaint, marginLeft: 6 }}>@{activity.author.username}</span>}
                  {isMe && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>{t("· moi")}</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textFaint }}>{timeAgo(activity.created_at)}{activity.type === "post" && activity.data?.edited_at ? ` · ${t("modifié")}` : ""}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: meta.tagBg, color: meta.tagColor, display: "inline-flex", alignItems: "center", gap: 5 }}>{meta.tagIcon && <Icon name={meta.tagIcon} size={12} />}{meta.tag}</span>
            </div>

            {activity.type === "post" ? (
              <>
                {postEdit?.id === activity.id ? (
                  <div style={{ marginBottom: 12 }}>
                    <TagField as="textarea" value={postEdit.text} onValueChange={v => setPostEdit(e => ({ ...e, text: v }))}
                      tags={postEdit.tags} onTagsChange={t => setPostEdit(e => ({ ...e, tags: t }))} myId={userId} T={T}
                      autoFocus maxLength={5000}
                      style={{ minHeight: 90, resize: "vertical", padding: "9px 12px", fontSize: 14, lineHeight: 1.5, borderRadius: 10, border: `0.5px solid ${T.accent}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }} />
                    {postEdit.error && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{postEdit.error}</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                      {/* onMouseDown : garde le focus pour que la liste de suggestions ne se ferme pas sous le clic */}
                      <button onMouseDown={e => e.preventDefault()} onClick={() => setPostEdit(null)} style={btnAct}>{t("Annuler")}</button>
                      <button onMouseDown={e => e.preventDefault()} onClick={() => savePostEdit(activity)} disabled={postEdit.saving}
                        style={{ ...btnAct, background: T.accent, borderColor: T.accent, color: T.onAccent, fontWeight: 700 }}>{postEdit.saving ? "…" : t("Enregistrer")}</button>
                    </div>
                  </div>
                ) : activity.data?.content && (
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
                <MovementTitle meta={meta} T={T}
                  label={TRADE_TYPES.includes(activity.type) ? activity.data?.label : null}
                  lookup={labelLookup?.id === activity.id ? labelLookup : null}
                  onOpenLabel={label => openLabel(activity.id, label)} />
                {activity.type === "declaration_13f" && <DeclarationMoves data={activity.data} T={T} onOpenLabel={label => openLabel(activity.id, label)} />}
                {(meta.stat || TRADE_TYPES.includes(activity.type)) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    {meta.stat && <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.stat}</span>}
                    {TRADE_TYPES.includes(activity.type) && (() => {
                      const src = tradeSource(activity.data);
                      return <span title={src.title} style={{ fontSize: 11, color: T.textFaint, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon emoji={src.icon} size={12} />{src.label}</span>;
                    })()}
                  </div>
                )}
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
                <Icon name="like" size={14} />{like.mine ? t("Liké") : t("Like")}{like.count > 0 ? ` · ${like.count}` : ""}
              </button>
              <button onClick={() => toggleComment(activity.id)} style={btnAct}>
                <Icon name="comment" size={14} />{activityComments.length > 0 ? activityComments.length : t("Commenter")}
              </button>
              {isMe && TRADE_TYPES.includes(activity.type) && !activity.note && noteEditing !== activity.id && (
                <button onClick={() => setNoteEditing(activity.id)} title={t("Explique ce mouvement : ta stratégie, ton ressenti…")}
                  style={{ ...btnAct, border: "none", color: T.textMuted }}>
                  <Icon name="edit" size={14} />{t("Ajouter une description")}
                </button>
              )}
              {isMe && activity.type === "post" && postEdit?.id !== activity.id && confirmDelete !== activity.id && (
                <button onClick={() => setPostEdit({ id: activity.id, text: activity.data?.content || "", tags: { tickers: activity.data?.tickers || [], mentions: activity.data?.mentions || [] }, saving: false, error: "" })}
                  title={t("Modifier le post")} aria-label={t("Modifier le post")} style={{ ...btnAct, marginLeft: "auto", border: "none" }}><Icon name="edit" size={14} /></button>
              )}
              {isMe && activity.type === "post" && (
                confirmDelete === activity.id ? (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.textMuted }}>{t("Supprimer ce post ?")}</span>
                    <button onClick={() => deletePost(activity)} disabled={deleting} style={{ ...btnAct, borderColor: T.red, color: T.red }}>{deleting ? "…" : t("Supprimer")}</button>
                    <button onClick={() => setConfirmDelete(null)} style={btnAct}>{t("Annuler")}</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(activity.id)} title={t("Supprimer le post")} aria-label={t("Supprimer le post")} style={{ ...btnAct, ...(postEdit?.id === activity.id ? { marginLeft: "auto" } : {}), border: "none" }}><Icon name="trash" size={14} /></button>
                )
              )}
            </div>

            {openComment[activity.id] && renderComments({
              list: activityComments, inputKey: activity.id, canDeleteAll: isMe,
              onAdd: () => addComment(activity), onDelete: id => deleteComment(activity.id, id),
            })}
          </div>
        );
      })}
    </div>
  );
}
