import { useState } from "react";

// Image d'un article (fournie par Bing Actualités ou Google) ; disparaît si elle ne charge pas
export default function ArticleImage({ src, style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
    style={{ display: "block", objectFit: "cover", background: "rgba(128,128,128,0.12)", ...style }} />;
}
