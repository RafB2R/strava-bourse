import Avatar from "./Avatar";
import { RichText, TickerChips } from "./PostText";
import { PostImages, PostFiles } from "./PostMedia";

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

// Post d'un de mes clubs, affiché dans le fil : on le like ici (réaction 👍 du club),
// les réponses se lisent et s'écrivent dans le club.
export default function ClubFeedCard({ post, T, card, btnAct, onOpenClub, onAsset, onProfile, myId, onLike }) {
  const name = post.author?.full_name;
  const replies = post.reply_count || 0;
  const likes = (post.reactions || []).filter(r => r.type === "👍");
  const liked = likes.some(r => r.user_id === myId);
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar userId={post.user_id} name={name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer" }} onClick={() => onProfile?.(post.user_id)}>
            {name}
            {post.author?.username && <span style={{ fontSize: 12, fontWeight: 400, color: T.textFaint, marginLeft: 6 }}>@{post.author.username}</span>}
          </div>
          <div style={{ fontSize: 12, color: T.textFaint }}>{timeAgo(post.created_at)}</div>
        </div>
        {post.club && (
          <button onClick={() => onOpenClub?.(post.club)} title={`Ouvrir le club ${post.club.name}`}
            style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: "rgba(175,169,236,0.1)", color: T.purple, border: "none", cursor: "pointer", fontFamily: "inherit", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            👥 {post.club.name}
          </button>
        )}
      </div>

      {post.content?.trim() && (
        <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          <RichText text={post.content} tickers={post.tags?.tickers} mentions={post.tags?.mentions} T={T} onAsset={onAsset} onProfile={onProfile} />
        </div>
      )}
      <TickerChips tickers={post.tags?.tickers} T={T} onAsset={onAsset} />
      <PostImages images={post.images} T={T} />
      <PostFiles files={post.files} T={T} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onLike} style={{ ...btnAct, ...(liked ? { borderColor: T.accent, color: T.accent } : {}) }}>
          👍 {liked ? "Liké" : "Like"}{likes.length > 0 ? ` · ${likes.length}` : ""}
        </button>
        <button onClick={() => onOpenClub?.(post.club)} title="Lire et écrire les réponses dans le club" style={btnAct}>
          💬 {replies > 0 ? `${replies} réponse${replies > 1 ? "s" : ""}` : "Répondre"}
        </button>
      </div>
    </div>
  );
}
