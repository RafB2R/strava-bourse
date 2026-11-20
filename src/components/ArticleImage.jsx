import { useState } from "react";

// Image d'un article (vignette de Bing Actualités ou image de partage du journal).
// Sans image, ou si elle ne charge pas : le logo du journal (« site » : son nom de domaine),
// sur un fond teinté, pour que la carte garde un visuel. Sans site connu : rien.
export default function ArticleImage({ src, site, T, style, logoSize = 40 }) {
  const [failed, setFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      style={{ display: "block", objectFit: "cover", background: "rgba(128,128,128,0.12)", ...style }} />;
  }
  if (!site || logoFailed || !T) return null;
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.accentBg}, ${T.bgSubtle})`, ...style }}>
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=128`} alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={() => setLogoFailed(true)} style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 5, background: "#fff", padding: logoSize / 10, boxSizing: "border-box" }} />
    </div>
  );
}
