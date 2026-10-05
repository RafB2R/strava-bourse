import { useState, useEffect } from "react";
import { mediaUrl } from "../media";

// Images d'un post : 1 en grand, 2 côte à côte, 3-4 en grille. Clic → plein écran.
export function PostImages({ images, T }) {
  const [open, setOpen] = useState(null);
  const list = (images || []).map(img => ({ ...img, url: mediaUrl(img.path) })).filter(img => img.url).slice(0, 4);
  if (list.length === 0) return null;

  const single = list.length === 1;
  const ratio = single && list[0].w && list[0].h ? Math.min(Math.max(list[0].w / list[0].h, 0.75), 2) : null;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: single ? "1fr" : "1fr 1fr", gap: 4, borderRadius: 12, overflow: "hidden", border: `0.5px solid ${T.border}`, marginBottom: 12 }}>
        {list.map((img, i) => (
          <button key={img.path} onClick={() => setOpen(i)} aria-label={`Agrandir l'image ${i + 1}`}
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
      <button onClick={onClose} aria-label="Fermer" style={{ ...nav, top: 16, right: 16, transform: "none" }}>✕</button>
      {n > 1 && <>
        <button onClick={e => { e.stopPropagation(); onIndex((index - 1 + n) % n); }} aria-label="Image précédente" style={{ ...nav, left: 12 }}>‹</button>
        <button onClick={e => { e.stopPropagation(); onIndex((index + 1) % n); }} aria-label="Image suivante" style={{ ...nav, right: 12 }}>›</button>
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
          <button onClick={() => onRemove(i)} aria-label="Retirer l'image"
            style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      ))}
    </div>
  );
}
