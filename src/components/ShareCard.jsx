import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T as TLive } from "../theme";
import { drawShareCard, shareText, SHARE_FORMATS } from "../shareCard";
import { Circle } from "lucide-react";
import Icon from "./Icon";
import { t } from "../i18n";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
const DOMAIN = APP_URL.replace(/^https?:\/\//, "");

// Série, badges et score de diversification de l'utilisateur (vue member_stats)
async function fetchMyStats(userId) {
  const { data } = await supabase
    .from("member_stats")
    .select("full_name, username, streak_mois, nb_badges, score_diversif")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

function canvasToFile(canvas) {
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob && new File([blob], "verio-portefeuille.png", { type: "image/png" })), "image/png"));
}

// allocation : [{ label, pct, color }] ; positions : [{ label, pct, perf }]
export default function ShareCard({ session, perf, allocation, positions, onClose, T: TProp }) {
  const T = TProp || TLive;
  const canvasRef = useRef(null);
  const [format, setFormat] = useState("story");
  const [showPerf, setShowPerf] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchMyStats(userId).then(s => { if (!ignore) setStats(s || {}); });
    return () => { ignore = true; };
  }, [userId]);

  const data = {
    name: stats?.full_name,
    username: stats?.username,
    perf,
    streak: Number(stats?.streak_mois || 0),
    badges: Number(stats?.nb_badges || 0),
    diversif: Number(stats?.score_diversif || 0),
    allocation,
    positions,
    domain: DOMAIN,
  };

  useEffect(() => {
    if (stats && canvasRef.current) drawShareCard(canvasRef.current, data, { format, showPerf, showPositions });
  });

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const text = shareText(data, { showPerf });
  const nativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share() {
    setMessage("");
    const file = await canvasToFile(canvasRef.current);
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${APP_URL}` });
      } else {
        await navigator.share({ text, url: APP_URL });
        setMessage(t("Ton navigateur ne partage pas les images : télécharge-la pour la publier."));
      }
    } catch (e) {
      if (e?.name !== "AbortError") setMessage(t("Le partage n'a pas abouti. Tu peux télécharger l'image."));
    }
  }

  async function download() {
    const file = await canvasToFile(canvasRef.current);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verio-portefeuille-${format}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(t("Image téléchargée"));
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(APP_URL)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${APP_URL}`)}`;

  const pill = active => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${active ? T.accent : T.border}`, background: active ? T.accentBg : "none", color: active ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 600 : 400 });
  const btn = { flex: 1, padding: "11px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "center", textDecoration: "none" };
  const btnPrimary = { ...btn, background: T.accent, color: T.onAccent, border: "none" };
  const btnSecondary = { ...btn, background: "none", color: T.text, border: `0.5px solid ${T.borderStrong}` };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={t("Partager mon portefeuille")} onClick={e => e.stopPropagation()} style={{ background: T.bgSecondary, border: `0.5px solid ${T.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 440, maxHeight: "calc(100vh / var(--verio-zoom, 1) - 32px)", overflowY: "auto", fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 8 }}><Icon name="share" size={16} />{t("Partager mon portefeuille")}</div>
          <button onClick={onClose} aria-label={t("Fermer")} style={{ background: "none", border: "none", fontSize: 18, color: T.textFaint, cursor: "pointer", display: "inline-flex", padding: 4 }}><Icon name="close" size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(SHARE_FORMATS).map(([id, f]) => (
            <button key={id} onClick={() => setFormat(id)} style={pill(format === id)}>{f.label} · {f.hint}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={() => setShowPerf(v => !v)} style={pill(showPerf)}>{showPerf ? <Icon name="check" size={13} /> : <Circle size={13} strokeWidth={1.75} aria-hidden="true" />}{t("Performance")}</button>
          {format === "story" && <button onClick={() => setShowPositions(v => !v)} style={pill(showPositions)}>{showPositions ? <Icon name="check" size={13} /> : <Circle size={13} strokeWidth={1.75} aria-hidden="true" />}{t("Positions")}</button>}
        </div>

        <div style={{ display: "flex", justifyContent: "center", background: T.bgSubtle, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          {!stats && <div style={{ fontSize: 13, color: T.textFaint, padding: "4rem 0" }}>{t("Préparation de l'image…")}</div>}
          <canvas ref={canvasRef} style={{ display: stats ? "block" : "none", width: "auto", height: "auto", maxWidth: "100%", maxHeight: format === "story" ? "52vh" : "40vh", borderRadius: 10 }} />
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center", marginBottom: 14 }}><Icon name="lock" size={12} style={{ marginRight: 4 }} />{t("Aucun montant n'apparaît sur l'image, seulement des pourcentages.")}</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {nativeShare && <button onClick={share} style={btnPrimary}>{t("Partager")}</button>}
          <button onClick={download} style={nativeShare ? btnSecondary : btnPrimary}>{t("Télécharger l'image")}</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer" style={btnSecondary}>{t("Publier sur X")}</a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={btnSecondary}>WhatsApp</a>
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10, lineHeight: 1.5 }}>
          {t("Pour Instagram : sur mobile, « Partager » puis Instagram. Sur ordinateur, télécharge l'image puis publie-la depuis ton téléphone. X et WhatsApp reçoivent le texte et le lien ; ajoute l'image téléchargée si tu veux.")}
        </div>
        {message && <div style={{ fontSize: 12, color: T.accent, marginTop: 10, textAlign: "center" }}>{message}</div>}
      </div>
    </div>
  );
}
