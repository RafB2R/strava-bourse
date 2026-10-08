import { useState, useEffect } from "react";
import { mediaUrl, fileUrl, fileExt, formatSize } from "../media";
import { POLL_MAX_OPTIONS, POLL_OPTION_MAX_LENGTH, POLL_DURATIONS, isValidPoll, pollRemaining } from "../polls";
import Icon from "./Icon";
import { t } from "../i18n";

// Images d'un post : 1 en grand, 2 côte à côte, 3-4 en grille. Clic → plein écran.
// « compact » : version messagerie (sans marge, coins plus petits) ; img.url remplace l'adresse publique
export function PostImages({ images, T, compact = false }) {
  const [open, setOpen] = useState(null);
  const list = (images || []).map(img => ({ ...img, url: img.url || mediaUrl(img.path) })).filter(img => img.url).slice(0, 4);
  if (list.length === 0) return null;

  const single = list.length === 1;
  const ratio = single && list[0].w && list[0].h ? Math.min(Math.max(list[0].w / list[0].h, 0.75), 2) : null;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: single ? "1fr" : "1fr 1fr", gap: compact ? 2 : 4, borderRadius: compact ? 10 : 12, overflow: "hidden", border: `0.5px solid ${T.border}`, marginBottom: compact ? 0 : 12, width: compact ? 220 : undefined, maxWidth: "100%" }}>
        {list.map((img, i) => (
          <button key={img.path} onClick={() => setOpen(i)} aria-label={t("Agrandir l'image {n}", { n: i + 1 })}
            style={{ padding: 0, border: "none", background: T.bgSubtle, cursor: "zoom-in", display: "block", minWidth: 0,
              gridColumn: list.length === 3 && i === 0 ? "1 / -1" : undefined,
              aspectRatio: single ? (ratio ? String(ratio) : "16 / 9") : list.length === 3 && i === 0 ? "2 / 1" : "1 / 1" }}>
            <img src={img.url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox images={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ images, index, onIndex, onClose }) {
  const n = images.length;
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && n > 1) onIndex((index + 1) % n);
      if (e.key === "ArrowLeft" && n > 1) onIndex((index - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, onIndex, onClose]);

  const nav = { position: "absolute", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: 999, width: 40, height: 40, fontSize: 20, cursor: "pointer" };
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <img src={images[index].url} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
      <button onClick={onClose} aria-label={t("Fermer")} style={{ ...nav, top: 16, right: 16, transform: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={20} /></button>
      {n > 1 && <>
        <button onClick={e => { e.stopPropagation(); onIndex((index - 1 + n) % n); }} aria-label={t("Image précédente")} style={{ ...nav, left: 12 }}>‹</button>
        <button onClick={e => { e.stopPropagation(); onIndex((index + 1) % n); }} aria-label={t("Image suivante")} style={{ ...nav, right: 12 }}>›</button>
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 13 }}>{index + 1} / {n}</div>
      </>}
    </div>
  );
}

// Aperçus dans l'encadré de publication, avec bouton pour retirer
export function ComposerPreviews({ items, onRemove, T }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {items.map((it, i) => (
        <div key={it.preview} style={{ position: "relative", width: 84, height: 84, borderRadius: 10, overflow: "hidden", border: `0.5px solid ${T.border}`, background: T.bgSubtle }}>
          <img src={it.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <button onClick={() => onRemove(i)} aria-label={t("Retirer l'image")}
            style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}><Icon name="close" size={12} /></button>
        </div>
      ))}
    </div>
  );
}

// Couleur de l'icône de fichier selon le type (PDF rouge, tableur vert, Word bleu, PowerPoint orange)
const FILE_COLORS = { pdf: "red", xls: "up", xlsx: "up", csv: "up", doc: "blue", docx: "blue", ppt: "orange", pptx: "orange" };
const FileIcon = ({ ext, T, size }) => <Icon name="file" size={size} style={{ color: T[FILE_COLORS[ext]] || T.textMuted }} />;

// Fichiers joints d'un post : nom, taille, ouverture (PDF) ou téléchargement
// « urls » (messagerie) : adresses signées fournies par l'appelant, à la place des adresses publiques
export function PostFiles({ files, T, urls = null, compact = false }) {
  const list = (files || []).map(f => ({ ...f, url: urls ? urls[f.path] : fileUrl(f) })).filter(f => f.url).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: compact ? 0 : 12, width: compact ? 240 : undefined, maxWidth: "100%" }}>
      {list.map(f => {
        const ext = fileExt(f.path);
        return (
          <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${T.border}`, background: T.bgSubtle, textDecoration: "none", minWidth: 0 }}>
            <FileIcon ext={ext} T={T} size={22} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name || t("Fichier .{ext}", { ext })}</span>
              <span style={{ display: "block", fontSize: 11, color: T.textFaint }}>{ext.toUpperCase()}{f.size ? ` · ${formatSize(f.size)}` : ""}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, flexShrink: 0 }}>{ext === "pdf" ? t("Ouvrir") : t("Télécharger")}</span>
          </a>
        );
      })}
    </div>
  );
}

// Fichiers choisis dans l'encadré de publication
export function ComposerFiles({ files, onRemove, T }) {
  if (files.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgSubtle, minWidth: 0 }}>
          <FileIcon ext={fileExt(f.name)} T={T} size={16} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          <span style={{ fontSize: 11, color: T.textFaint }}>{formatSize(f.size)}</span>
          <button onClick={() => onRemove(i)} aria-label={t("Retirer {name}", { name: f.name })} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center" }}><Icon name="close" size={12} /></button>
        </div>
      ))}
    </div>
  );
}

// Édition du sondage dans l'encadré de publication
export function PollEditor({ options, onOptions, days, onDays, onRemove, T }) {
  const input = { flex: 1, minWidth: 0, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" };
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, border: `0.5px solid ${T.border}`, background: T.bgSubtle }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="chart" size={14} />{t("Sondage")} <span style={{ fontWeight: 400 }}>{t("· la question est le texte du post")}</span></span>
        <button onClick={onRemove} aria-label={t("Retirer le sondage")} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center" }}><Icon name="close" size={12} /></button>
      </div>
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={o} maxLength={POLL_OPTION_MAX_LENGTH} placeholder={i >= 2 ? t("Choix {n} (facultatif)", { n: i + 1 }) : t("Choix {n}", { n: i + 1 })} aria-label={t("Choix {n}", { n: i + 1 })}
            onChange={e => onOptions(options.map((x, j) => (j === i ? e.target.value : x)))} style={input} />
          {i >= 2 && <button onClick={() => onOptions(options.filter((_, j) => j !== i))} aria-label={t("Retirer le choix {n}", { n: i + 1 })} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center" }}><Icon name="close" size={12} /></button>}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {options.length < POLL_MAX_OPTIONS && (
          <button onClick={() => onOptions([...options, ""])} style={{ background: "none", border: `0.5px dashed ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("+ Ajouter un choix")}</button>
        )}
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
          {t("Durée")}
          <select value={days} onChange={e => onDays(Number(e.target.value))} style={{ padding: "4px 6px", fontSize: 12, borderRadius: 6, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }}>
            {POLL_DURATIONS.map(d => <option key={d.days} value={d.days}>{d.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

// Sondage dans le fil : boutons tant qu'on n'a pas voté, puis résultats en %
export function PollView({ poll, counts, myVote, isAuthor, onVote, T }) {
  const [sending, setSending] = useState(false);
  if (!isValidPoll(poll)) return null;
  const votes = poll.options.map((_, i) => counts?.[i] || 0);
  const total = votes.reduce((s, v) => s + v, 0);
  const closed = !(new Date(poll.ends_at) > new Date());
  const voted = myVote !== undefined && myVote !== null;
  const showResults = voted || closed || isAuthor;
  const best = Math.max(...votes);

  async function choose(i) {
    if (sending) return;
    setSending(true);
    await onVote(i);
    setSending(false);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {poll.options.map((label, i) => {
          const pct = total ? Math.round((votes[i] / total) * 100) : 0;
          if (!showResults) {
            return (
              <button key={i} onClick={() => choose(i)} disabled={sending}
                style={{ padding: "9px 12px", borderRadius: 999, border: `1px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                {label}
              </button>
            );
          }
          const lead = closed && total > 0 && votes[i] === best;
          return (
            <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: T.bgSubtle, border: `0.5px solid ${myVote === i ? T.accent : T.border}` }}>
              <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: lead || myVote === i ? T.accentBg : "rgba(128,128,128,0.12)" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 13 }}>
                <span style={{ flex: 1, color: T.text, fontWeight: lead ? 700 : 500 }}>{label}{myVote === i && <span style={{ color: T.accent, marginLeft: 5 }}><Icon name="check" size={14} /></span>}</span>
                <span style={{ color: T.text, fontWeight: 700 }}>{t("{n} %", { n: pct })}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>
        {total > 1 ? t("{n} votes", { n: total }) : t("{n} vote", { n: total })} · {pollRemaining(poll.ends_at)}{!showResults ? ` · ${t("votes anonymes")}` : ""}
      </div>
    </div>
  );
}
