import { useState, useEffect, useRef } from "react";
import { T as TLive } from "../theme";
import { supabase, PUBLIC_PROFILE_COLUMNS } from "../supabase";
import Badges from "./Badges";
import { syncBadges } from "../badges";
import KYC from "./KYC";
import { normalizeUsername, usernameFormatError, isUsernameAvailable } from "../usernames";
import InstallBanner from "./InstallBanner";
import PushSettings from "./PushSettings";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { avatarUrl, uploadAvatar, removeAvatar } from "../avatars";
import { t, LANG, setLang } from "../i18n";

const STRATEGIES = ["ETF passif", "Stock picking", "Dividendes", "Value investing", "DCA", "Mixte"];


// Mes stats de portefeuille (colonnes publiques uniquement), ou null sans position
async function fetchOwnStats(userId) {
  const { data } = await supabase.from("portfolio_entries").select("performance, percentage, type, broker").eq("user_id", userId);
  if (data && data.length > 0) {
    const avecPerf = data.filter(d => d.performance !== null);
    const totalPct = avecPerf.reduce((s, d) => s + Number(d.percentage), 0);
    const perf = totalPct > 0 ? avecPerf.reduce((s, d) => s + (Number(d.performance) * Number(d.percentage)) / totalPct, 0) : null;
    const types = new Set(data.map(d => d.type)).size;
    const brokers = new Set(data.filter(d => d.broker).map(d => d.broker)).size;
    const allPct = data.reduce((s, d) => s + Number(d.percentage), 0);
    return { positions: data.length, perfPonderee: perf, types, brokers, totalPct: allPct };
  }
  return null;
}

async function fetchFriendships(userId) {
  const { data } = await supabase.from("friendships").select(`id, status, requester_id, receiver_id, requester:profiles!friendships_requester_id_fkey(id, full_name, username, city, strategy), receiver:profiles!friendships_receiver_id_fkey(id, full_name, username, city, strategy)`).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  if (!data) return null;
  // Sans le profil de l'autre membre (compte supprimé…), la ligne est ignorée
  return {
    friends: data.filter(f => f.status === "accepted").map(f => ({ ...f, friend: f.requester_id === userId ? f.receiver : f.requester })).filter(f => f.friend),
    pending: data.filter(f => f.status === "pending" && f.requester_id === userId).map(f => ({ ...f, friend: f.receiver })).filter(f => f.friend),
    received: data.filter(f => f.status === "pending" && f.receiver_id === userId).map(f => ({ ...f, friend: f.requester })).filter(f => f.friend),
  };
}

// Performance pondérée de chaque ami (vue member_stats)
async function fetchFriendPerfs(friends) {
  const { data } = await supabase.from("member_stats").select("id, perf").in("id", friends.map(f => f.friend.id));
  const perfById = Object.fromEntries((data || []).map(d => [d.id, d.perf === null ? null : Number(d.perf)]));
  return friends.map(f => ({ id: f.friend.id, name: f.friend.full_name, perf: perfById[f.friend.id] ?? null, me: false }));
}

function StatsSection({ profile, session, friends, perf, T, onViewProfile }) {
  const [friendPerfs, setFriendPerfs] = useState(null);
  const loading = friends.length > 0 && friendPerfs === null;

  useEffect(() => {
    if (friends.length === 0) return;
    let ignore = false;
    fetchFriendPerfs(friends).then(perfs => { if (!ignore) setFriendPerfs(perfs); });
    return () => { ignore = true; };
  }, [friends]);

  const ranking = [{ id: session.user.id, name: profile?.full_name, perf, me: true }, ...(friendPerfs || [])]
    .sort((a, b) => (b.perf ?? -Infinity) - (a.perf ?? -Infinity));


  return (
    <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Classement amis")}</div>
      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>{t("Chargement…")}</div>}
      {!loading && friends.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem 0" }}>{t("Ajoute des amis pour voir le classement")}</div>}
      {!loading && ranking.map((f, i) => (
        <div key={i} onClick={() => !f.me && onViewProfile && onViewProfile(f.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, cursor: f.me ? "default" : "pointer" }}>
          <div style={{ fontSize: 13, color: i === 0 ? T.gold : i === 1 ? T.medals["🥈"] : i === 2 ? T.medals["🥉"] : T.textFaint, minWidth: 20, fontWeight: 600 }}>{i + 1}</div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {f.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1, fontSize: 14, color: f.me ? T.text : T.accent }}>
            {f.name}{f.me && <span style={{ fontSize: 11, color: T.textFaint }}> · {t("moi")}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: f.perf === null ? T.textFaint : f.perf >= 0 ? T.up : T.red }}>
            {f.perf === null ? "—" : `${f.perf >= 0 ? "+" : ""}${f.perf.toFixed(1)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

// card style sera généré dynamiquement avec T
// inp style sera généré dynamiquement avec T
// btn style sera généré dynamiquement avec T
// btnSm style sera généré dynamiquement avec T
// btnGreen style sera généré dynamiquement avec T
// btnRed style sera généré dynamiquement avec T
// sectionLabel style sera généré dynamiquement avec T

export default function Profil({ profile: initialProfile, session, T: TProp, onViewProfile, initialSection = "stats" }) {
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: `0.5px solid ${T.input.border}`, background: T.input.background, color: T.input.color, fontFamily: "inherit", marginBottom: 10, display: "block" };
  const btn = { background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
  const btnSm = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };
  const btnGreen = { background: "none", border: `0.5px solid ${T.accent}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.accent, cursor: "pointer", fontFamily: "inherit" };
  const btnRed = { background: "none", border: `0.5px solid ${T.red}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.red, cursor: "pointer", fontFamily: "inherit" };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };
  const [profile, setProfile] = useState(initialProfile || {});
  const [section, setSection] = useState(initialSection);
  // Photo de profil
  const photoInput = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  useEffect(() => {
    const url = avatarUrl(session.user.id);
    if (!url) return;
    let ignore = false;
    fetch(url, { method: "HEAD" }).then(r => { if (!ignore) setHasPhoto(r.ok); }).catch(() => {});
    return () => { ignore = true; };
  }, [session.user.id]);

  async function changePhoto(file) {
    if (!file) return;
    setPhotoBusy(true); setPhotoError("");
    try { await uploadAvatar(session.user.id, file); setHasPhoto(true); }
    catch (e) { setPhotoError(e.message); }
    setPhotoBusy(false);
  }

  async function deletePhoto() {
    setPhotoBusy(true); setPhotoError("");
    try { await removeAvatar(session.user.id); setHasPhoto(false); }
    catch (e) { setPhotoError(e.message); }
    setPhotoBusy(false);
  }
  const [editing, setEditing] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ positions: 0, perfPonderee: null, types: 0, brokers: 0, totalPct: 0 });
  const [friends, setFriends] = useState([]);

  const [pending, setPending] = useState([]);
  const [received, setReceived] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  // Resynchronise le profil quand App en fournit une nouvelle version
  const [prevInitialProfile, setPrevInitialProfile] = useState(initialProfile);
  if (initialProfile !== prevInitialProfile) {
    setPrevInitialProfile(initialProfile);
    if (initialProfile) setProfile(initialProfile);
  }

  const userId = session.user.id;
  const [friendsKey, setFriendsKey] = useState(0);
  const reloadFriendships = () => setFriendsKey(k => k + 1);

  useEffect(() => {
    let ignore = false;
    fetchOwnStats(userId).then(ownStats => { if (!ignore && ownStats) setStats(ownStats); });
    return () => { ignore = true; };
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    fetchFriendships(userId).then(result => {
      if (ignore || !result) return;
      setFriends(result.friends);
      setPending(result.pending);
      setReceived(result.received);
    });
    return () => { ignore = true; };
  }, [userId, friendsKey]);

  // Badges : calcul et attribution côté serveur, série de mois comprise
  const [badgeState, setBadgeState] = useState(null);
  useEffect(() => {
    let ignore = false;
    syncBadges().then(result => { if (!ignore && result) setBadgeState(result); });
    return () => { ignore = true; };
  }, [userId]);

  async function searchUsers(q) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    // Retire les caractères qui ont un sens dans la syntaxe de filtre PostgREST
    const safe = q.replace(/[,()%*\\]/g, " ").trim();
    const { data } = await supabase.from("profiles").select("id, full_name, username, city, strategy").neq("id", session.user.id).or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`).limit(5);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function sendRequest(receiverId) {
    const { error } = await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: receiverId, status: "pending" });
    if (error) setMessage(t("Demande déjà envoyée."));
    else { setMessage(t("Demande envoyée")); setSearch(""); setSearchResults([]); reloadFriendships(); }
    setTimeout(() => setMessage(""), 3000);
  }

  async function acceptRequest(id) {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    // Prévient celui qui avait demandé (le nom de l'expéditeur est fixé par la base)
    const request = received.find(f => f.id === id);
    if (!error && request?.requester_id) await supabase.from("notifications").insert({ user_id: request.requester_id, type: "friend_accepted", data: {} });
    reloadFriendships();
  }
  async function declineRequest(id) { await supabase.from("friendships").delete().eq("id", id); reloadFriendships(); }

  function startEdit() {
    setForm({ full_name: profile.full_name || "", username: profile.username || "", city: profile.city || "", bio: profile.bio || "", strategy: profile.strategy || "ETF passif", investing_since: profile.investing_since || "" });
    setEditing(true);
  }

  async function saveProfile() {
    setEditError("");
    const username = normalizeUsername(form.username);
    if (username !== (profile.username || "")) {
      const formatError = usernameFormatError(username);
      if (formatError) { setEditError(t("Nom d'utilisateur : {error}", { error: formatError.toLowerCase() })); return; }
      setSaving(true);
      if (await isUsernameAvailable(username) === false) { setEditError(t("@{username} est déjà pris, choisis-en un autre.", { username })); setSaving(false); return; }
    }
    setSaving(true);
    const { data, error } = await supabase.from("profiles").update({ full_name: form.full_name, username, city: form.city, bio: form.bio, strategy: form.strategy, investing_since: form.investing_since || null }).eq("id", session.user.id).select(PUBLIC_PROFILE_COLUMNS).single();
    setSaving(false);
    if (error || !data) { setEditError(t("Enregistrement impossible. Réessaie.")); return; }
    setProfile(p => ({ ...p, ...data })); setSaved(true); setTimeout(() => setSaved(false), 2000);
    setEditing(false);
  }

  const perf = stats.perfPonderee;
  const alreadyIds = [...friends, ...pending, ...received].map(f => f.friend?.id).filter(Boolean);

  const unlockedCount = badgeState ? badgeState.badges.length : 0;

  return (
    <div>
      <InstallBanner T={T} always />
      <PushSettings T={T} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "10px 14px", marginBottom: 16 }}>
        <span style={{ display: "flex", flexShrink: 0, color: T.textMuted }} aria-hidden="true"><Icon name="globe" size={20} /></span>
        <label htmlFor="verio-lang" style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.text }}>Langue / Language</label>
        <select id="verio-lang" value={LANG} onChange={e => setLang(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.input.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit", cursor: "pointer" }}>
          <option value="fr" style={{ background: T.bgSecondary }}>Français</option>
          <option value="en" style={{ background: T.bgSecondary }}>English</option>
        </select>
      </div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          {/* Photo de profil : clic pour en choisir une */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden
              onChange={e => { changePhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => photoInput.current?.click()} disabled={photoBusy} title={t("Changer ma photo de profil")} aria-label={t("Changer ma photo de profil")}
              style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: "50%", opacity: photoBusy ? 0.5 : 1 }}>
              <Avatar userId={session.user.id} name={profile.full_name} size={56} />
              <span style={{ position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: "50%", background: T.bgCard, border: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: T.textMuted }}><Icon name="camera" size={12} /></span>
            </button>
            {hasPhoto && <button onClick={deletePhoto} disabled={photoBusy} style={{ background: "none", border: "none", padding: 0, fontSize: 10, color: T.textFaint, cursor: "pointer", fontFamily: "inherit" }}>{t("Retirer")}</button>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{profile.full_name || "—"}</div>
            <div style={{ fontSize: 13, color: T.textMuted }}>@{profile.username || "—"}{profile.city ? ` · ${profile.city}` : ""}</div>
            {profile.strategy && <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: T.accentBg, color: T.accent }}>{t(profile.strategy)}</span>}
          </div>
          <button style={{ ...btnSm, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={startEdit}><Icon name="edit" size={13} />{t("Éditer")}</button>
        </div>
        {photoError && <div role="alert" style={{ fontSize: 12, color: T.red, margin: "-8px 0 12px" }}>{photoError}</div>}

        {profile.bio && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 16, padding: "10px 12px", background: T.bgSubtle, borderRadius: 8 }}>{profile.bio}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            [t("Positions"), stats.positions, T.accent],
            [t("Perf. depuis l'achat"), perf === null ? "—" : `${perf >= 0 ? "+" : ""}${perf.toFixed(2)}%`, perf === null ? T.textFaint : perf >= 0 ? T.up : T.red],
            [t("Depuis"), profile.investing_since || "—", T.text],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: T.bgSubtle, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
        {saved && <div style={{ marginTop: 12, padding: "8px 12px", background: T.accentBg, borderRadius: 8, fontSize: 13, color: T.accent, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="ok" size={14} />{t("Profil mis à jour !")}</div>}
      </div>

      {editing && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><Icon name="edit" size={15} />{t("Modifier mon profil")}</div>
          {[[t("Prénom et nom"), "full_name", "Raphael Dupont"], [t("Nom d'utilisateur"), "username", "raphaeld"], [t("Ville"), "city", "Paris"]].map(([label, key, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{label}</label>
              <input style={inp} placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Bio")}</label>
          <textarea style={{ ...inp, height: 80, resize: "vertical" }} placeholder={t("Investisseur passif…")} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Stratégie")}</label>
          <select style={{ ...inp, background: T.bgCard }} value={form.strategy} onChange={e => setForm({ ...form, strategy: e.target.value })}>
            {STRATEGIES.map(s => <option key={s} value={s} style={{ background: T.bgSecondary }}>{t(s)}</option>)}
          </select>
          <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Investisseur depuis (année)")}</label>
          <input style={inp} placeholder="2018" type="number" value={form.investing_since} onChange={e => setForm({ ...form, investing_since: e.target.value })} />
          <div style={{ height: "0.5px", background: T.border, margin: "16px 0" }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, marginBottom: 10 }}>{t("Profil investisseur")}</div>
          <button
            onClick={() => { setEditing(false); setShowKYC(true); }}
            style={{ width: "100%", padding: "10px", background: T.accentBg, border: `0.5px solid ${T.accentBorder}`, borderRadius: 10, fontSize: 13, color: T.accent, cursor: "pointer", fontFamily: "inherit", marginBottom: 14, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="list" size={14} />{t("Modifier mon profil investisseur")} →
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {editError && <div role="alert" style={{ fontSize: 13, color: T.red, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="warning" size={14} />{editError}</div>}
            <button style={btn} onClick={saveProfile} disabled={saving}>{saving ? t("Enregistrement…") : t("Sauvegarder")}</button>
            <button style={btnSm} onClick={() => setEditing(false)}>{t("Annuler")}</button>
          </div>
        </div>
      )}

      {showKYC && (
        <KYC
          session={session}
          profile={profile}
          onComplete={() => { setShowKYC(false); window.location.reload(); }}
          onSkip={() => setShowKYC(false)}
        />
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["stats", t("Stats"), "chart"], ["badges", t("Badges ({n})", { n: unlockedCount }), "award"], ["reseau", t("Réseau"), "users"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setSection(id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${section === id ? T.accent : T.border}`, background: section === id ? T.accentBg : "none", color: section === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>

      {section === "stats" && (
        <StatsSection profile={profile} session={session} friends={friends} perf={perf} T={T} onViewProfile={onViewProfile} />
      )}

      {section === "badges" && (
        <Badges badgeState={badgeState} T={T} />
      )}

      {section === "reseau" && (
        <div>
          <div style={card}>
            <div style={sectionLabel}>{t("Rechercher un investisseur")}</div>
            <input style={inp} placeholder={t("Nom ou @username…")} value={search} onChange={e => { setSearch(e.target.value); searchUsers(e.target.value); }} />
            {message && <div style={{ fontSize: 13, color: T.accent, marginBottom: 10 }}>{message}</div>}
            {searching && <div style={{ fontSize: 13, color: T.textFaint }}>{t("Recherche…")}</div>}
            {searchResults.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `0.5px solid ${T.border}` }}>
                <Avatar userId={u.id} name={u.full_name} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{u.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>@{u.username}</div>
                </div>
                {alreadyIds.includes(u.id) ? <span style={{ fontSize: 12, color: T.textFaint }}>{t("Déjà ajouté")}</span> : <button style={btnGreen} onClick={() => sendRequest(u.id)}>+ {t("Ajouter")}</button>}
              </div>
            ))}
            {search.length >= 2 && !searching && searchResults.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>{t("Aucun résultat")}</div>}
          </div>

          {received.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>{t("Demandes reçues ({n})", { n: received.length })}</div>
              {received.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `0.5px solid ${T.border}` }}>
                  <Avatar userId={f.friend.id} name={f.friend.full_name} size={34} />
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(f.friend.id)}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>{f.friend.full_name}</div>
                    <div style={{ fontSize: 12, color: T.textFaint }}>@{f.friend.username}</div>
                  </div>
                  <button style={{ ...btnGreen, display: "inline-flex" }} onClick={() => acceptRequest(f.id)} aria-label={t("Accepter")}><Icon name="check" size={14} /></button>
                  <button style={{ ...btnRed, display: "inline-flex" }} onClick={() => declineRequest(f.id)} aria-label={t("Refuser")}><Icon name="close" size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={card}>
            <div style={sectionLabel}>{t("Mes amis ({n})", { n: friends.length })}</div>
            {friends.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem 0" }}>{t("Aucun ami encore")}</div>}
            {friends.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `0.5px solid ${T.border}`, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(f.friend.id)}>
                <Avatar userId={f.friend.id} name={f.friend.full_name} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>{f.friend.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>@{f.friend.username}{f.friend.city ? ` · ${f.friend.city}` : ""}</div>
                  {f.friend.strategy && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 999, background: T.accentBg, color: T.accent }}>{t(f.friend.strategy)}</span>}
                </div>
                <button style={btnRed} onClick={() => declineRequest(f.id)}>{t("Retirer")}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
