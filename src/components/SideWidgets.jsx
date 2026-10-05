import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { avatarColors } from "../theme";
import { Avatar } from "./Messages";

// Encarts de la colonne de droite (ordinateur), sous les marchés : mes clubs, suggestions d'amis

const box = T => ({ background: T.bgSecondary, border: `1px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: 16, marginBottom: 16 });
const title = T => ({ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 });
const linkBtn = T => ({ width: "100%", background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: "inherit", marginTop: 12 });

async function fetchMyClubs(userId) {
  const { data } = await supabase.from("club_members").select("club:clubs(*)").eq("user_id", userId);
  return (data || []).map(r => r.club).filter(Boolean);
}

function clubInitials(name) {
  const words = (name || "?").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}

export function ClubsWidget({ session, T, onOpenClub, onAllClubs }) {
  const [clubs, setClubs] = useState(null);
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchMyClubs(userId).then(list => { if (!ignore) setClubs(list); });
    return () => { ignore = true; };
  }, [userId]);

  if (clubs === null) return null;
  return (
    <div style={box(T)}>
      <div style={title(T)}>👥 Vos clubs</div>
      {clubs.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>Rejoins un club pour échanger avec des investisseurs qui partagent ta stratégie.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {clubs.slice(0, 8).map(c => {
            const [bg, color] = avatarColors(c.name, T);
            return (
              <button key={c.id} onClick={() => onOpenClub(c)} title={c.name} aria-label={`Ouvrir le club ${c.name}`}
                style={{ width: 52, height: 52, borderRadius: 10, border: `0.5px solid ${T.border}`, background: bg, color, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {clubInitials(c.name)}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={() => onAllClubs(clubs.length > 0)} style={linkBtn(T)}>{clubs.length ? "Voir mes clubs" : "Découvrir les clubs"}</button>
    </div>
  );
}

export function FriendSuggestions({ session, T, onViewProfile, onFindFriends }) {
  const [list, setList] = useState(null);
  const [sent, setSent] = useState({});
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    supabase.rpc("friend_suggestions", { max_results: 3 }).then(({ data }) => { if (!ignore) setList(data || []); });
    return () => { ignore = true; };
  }, [userId]);

  async function sendRequest(otherId) {
    setSent(p => ({ ...p, [otherId]: "sending" }));
    const { error } = await supabase.from("friendships").insert({ requester_id: userId, receiver_id: otherId, status: "pending" });
    if (error) { setSent(p => ({ ...p, [otherId]: undefined })); return; }
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    await supabase.from("notifications").insert({ user_id: otherId, type: "friend_request", data: { from_name: me?.full_name, from_id: userId } });
    setSent(p => ({ ...p, [otherId]: "sent" }));
  }

  if (list === null) return null;
  return (
    <div style={box(T)}>
      <div style={title(T)}>🤝 Suggestions d'amis</div>
      {list.length === 0 && (
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>Ajoute des amis ou rejoins des clubs : on te proposera des investisseurs de ton réseau.</div>
      )}
      {list.map((s, i) => {
        const state = sent[s.id];
        const reason = s.mutual_friends > 0
          ? `${s.mutual_friends} ami${s.mutual_friends > 1 ? "s" : ""} en commun`
          : s.shared_club ? `Club ${s.shared_club}` : "";
        return (
          <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? `0.5px solid ${T.border}` : "none" }}>
            <button onClick={() => onViewProfile(s.id)} aria-label={`Voir le profil de ${s.full_name}`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <Avatar name={s.full_name} size={38} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button onClick={() => onViewProfile(s.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 13, fontWeight: 700, color: T.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                {s.full_name}
              </button>
              {(s.city || s.strategy) && <div style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[s.city, s.strategy].filter(Boolean).join(" · ")}</div>}
              {reason && <div style={{ fontSize: 11, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reason}</div>}
              <button onClick={() => sendRequest(s.id)} disabled={!!state}
                style={{ marginTop: 6, background: state === "sent" ? "none" : T.accentBg, border: `0.5px solid ${T.accent}`, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: state ? "default" : "pointer", fontFamily: "inherit" }}>
                {state === "sent" ? "✓ Demande envoyée" : state === "sending" ? "…" : "+ Ajouter"}
              </button>
            </div>
          </div>
        );
      })}
      <button onClick={onFindFriends} style={linkBtn(T)}>Trouver des amis</button>
    </div>
  );
}
