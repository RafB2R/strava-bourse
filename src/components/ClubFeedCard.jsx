import { avatarColors } from "../theme";
import { RichText, TickerChips } from "./PostText";
import { PostImages, PostFiles } from "./PostMedia";

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

// Post d'un de mes clubs, affiché dans le fil. Les réactions et réponses se font
// dans le club (bouton « Ouvrir dans le club »).
export default function ClubFeedCard({ post, T, card, btnAct, onOpenClub, onAsset, onProfile }) {
  const name = post.author?.full_name;
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = avatarColors(name);
  const replies = post.reply_count || 0;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
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
        <button onClick={() => onOpenClub?.(post.club)} style={btnAct}>
          💬 {replies > 0 ? `${replies} réponse${replies > 1 ? "s" : ""} · ` : ""}Ouvrir dans le club ›
        </button>
      </div>
    </div>
  );
}
