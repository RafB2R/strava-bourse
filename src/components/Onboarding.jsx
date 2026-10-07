import { useState, useEffect } from "react";
import { T as TLive } from "../theme";
import { supabase } from "../supabase";
import { INDICES } from "../indices";
import { fetchSuperInvestors, setFollowing } from "../superInvestors";
import { fetchFollowedAssets, setFollowingAsset } from "../assetFollows";
import Avatar from "./Avatar";

// Juste après le questionnaire d'inscription : premiers comptes à suivre, pour que
// le fil ne soit pas vide. Tout est facultatif (« Passer ») et se change ensuite.

const COMPANIES = [
  { symbol: "MC.PA", name: "LVMH" },
  { symbol: "TTE.PA", name: "TotalEnergies" },
  { symbol: "AI.PA", name: "Air Liquide" },
  { symbol: "AIR.PA", name: "Airbus" },
  { symbol: "SU.PA", name: "Schneider Electric" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
].map(c => ({ ...c, type: "Action" }));

// Membres actifs récemment (auteurs des dernières activités), hors moi et hors Super Investors
async function fetchActiveMembers(myId, superIds) {
  const { data } = await supabase.from("activities")
    .select("user_id, author:profiles!activities_user_id_fkey(full_name, username)")
    .neq("user_id", myId).order("created_at", { ascending: false }).limit(80);
  const seen = new Set();
  const out = [];
  for (const a of data || []) {
    if (a.user_id === myId || seen.has(a.user_id) || superIds.has(a.user_id) || !a.author?.full_name) continue;
    seen.add(a.user_id);
    out.push({ id: a.user_id, ...a.author });
    if (out.length === 6) break;
  }
  return out;
}

export default function Onboarding({ session, T: TProp, onDone }) {
  const T = TProp || TLive;
  const myId = session.user.id;
  const [supers, setSupers] = useState([]);
  const [members, setMembers] = useState([]);
  const [followedSupers, setFollowedSupers] = useState(new Set());
  const [followedAssets, setFollowedAssets] = useState(new Set());
  const [requested, setRequested] = useState(new Set());

  useEffect(() => {
    let ignore = false;
    (async () => {
      const list = await fetchSuperInvestors().catch(() => []);
      const assets = await fetchFollowedAssets(myId).catch(() => []);
      const people = await fetchActiveMembers(myId, new Set(list.map(s => s.user_id))).catch(() => []);
      if (ignore) return;
      setSupers(list);
      setFollowedAssets(new Set(assets.map(a => a.symbol)));
      setMembers(people);
    })();
    return () => { ignore = true; };
  }, [myId]);

  const toggleSet = (set, key, on) => { const next = new Set(set); if (on) next.add(key); else next.delete(key); return next; };

  async function toggleSuper(id) {
    const on = !followedSupers.has(id);
    setFollowedSupers(s => toggleSet(s, id, on));
    if (!(await setFollowing(id, myId, on))) setFollowedSupers(s => toggleSet(s, id, !on));
  }

  async function toggleAsset(asset) {
    const on = !followedAssets.has(asset.symbol);
    setFollowedAssets(s => toggleSet(s, asset.symbol, on));
    if (!(await setFollowingAsset(myId, asset, on))) setFollowedAssets(s => toggleSet(s, asset.symbol, !on));
  }

  async function requestFriend(member) {
    if (requested.has(member.id)) return;
    setRequested(s => toggleSet(s, member.id, true));
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", myId).single();
    const { error } = await supabase.from("friendships").insert({ requester_id: myId, receiver_id: member.id, status: "pending" });
    if (error) { setRequested(s => toggleSet(s, member.id, false)); return; }
    await supabase.from("notifications").insert({ user_id: member.id, type: "friend_request", data: { from_name: me?.full_name, from_id: myId } });
  }

  const total = followedSupers.size + followedAssets.size; // les demandes d'ami attendent une réponse
  const section = { fontSize: 11, color: T.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" };
  const chip = on => ({
    padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    border: `0.5px solid ${on ? T.accent : T.border}`, background: on ? T.accentBg : T.bgCard, color: on ? T.accent : T.text,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: T.bgSecondary, border: `0.5px solid ${T.border}`, borderRadius: 20, padding: "1.75rem", maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>Remplis ton fil</div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
          Suis quelques investisseurs, sociétés et indices : leurs mouvements et leurs actualités arriveront dans ton fil. Tu pourras changer ça à tout moment.
        </div>

        {supers.length > 0 && <>
          <div style={section}>🏆 Super Investors</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {supers.map(s => (
              <button key={s.user_id} onClick={() => toggleSuper(s.user_id)} aria-pressed={followedSupers.has(s.user_id)} title={`${s.firm} · ${s.style}`} style={chip(followedSupers.has(s.user_id))}>
                {s.icon} {s.profile?.full_name}{followedSupers.has(s.user_id) ? " ✓" : ""}
              </button>
            ))}
          </div>
        </>}

        <div style={section}>🏢 Sociétés</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COMPANIES.map(c => (
            <button key={c.symbol} onClick={() => toggleAsset(c)} aria-pressed={followedAssets.has(c.symbol)} style={chip(followedAssets.has(c.symbol))}>
              {c.name}{followedAssets.has(c.symbol) ? " ✓" : ""}
            </button>
          ))}
        </div>

        <div style={section}>📈 Indices</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INDICES.map(i => ({ symbol: i.symbol, name: i.name, type: "Indice" })).map(i => (
            <button key={i.symbol} onClick={() => toggleAsset(i)} aria-pressed={followedAssets.has(i.symbol)} style={chip(followedAssets.has(i.symbol))}>
              {i.name}{followedAssets.has(i.symbol) ? " ✓" : ""}
            </button>
          ))}
        </div>

        {members.length > 0 && <>
          <div style={section}>👥 Membres actifs</div>
          {members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `0.5px solid ${T.border}` }}>
              <Avatar userId={m.id} name={m.full_name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{m.full_name}</div>
                {m.username && <div style={{ fontSize: 12, color: T.textFaint }}>@{m.username}</div>}
              </div>
              <button onClick={() => requestFriend(m)} disabled={requested.has(m.id)} style={{ ...chip(requested.has(m.id)), padding: "5px 12px", fontSize: 12 }}>
                {requested.has(m.id) ? "Demande envoyée" : "+ Ajouter"}
              </button>
            </div>
          ))}
        </>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button onClick={onDone} style={{ background: "none", border: "none", fontSize: 13, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Passer</button>
          <button onClick={onDone} style={{ background: T.accent, border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            {total > 0 ? `C'est parti (${total} suivi${total > 1 ? "s" : ""})` : "C'est parti"}
          </button>
        </div>
      </div>
    </div>
  );
}
