import { useState, useEffect } from "react";
import { avatarColors } from "../theme";
import { avatarUrl, markMissing, onAvatarChange } from "../avatars";

// Avatar d'un membre : sa photo de profil s'il en a mis une, sinon ses initiales.
export default function Avatar({ userId, name, size = 36 }) {
  const [, refresh] = useState(0);
  useEffect(() => onAvatarChange(id => { if (id === userId) refresh(n => n + 1); }), [userId]);
  const url = avatarUrl(userId);
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = avatarColors(name);
  const box = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  if (url) {
    return (
      <img src={url} alt="" width={size} height={size} loading="lazy"
        onError={() => { markMissing(userId); refresh(n => n + 1); }}
        style={{ ...box, objectFit: "cover", display: "block", background: bg }} />
    );
  }
  return (
    <div style={{ ...box, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700 }}>
      {initials}
    </div>
  );
}
