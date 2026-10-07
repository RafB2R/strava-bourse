import { useState } from "react";
import { supabase } from "../supabase";
import { RichText, TagField } from "./PostText";
import { finalizeTags } from "../tags";

// Commentaire de l'auteur sous un mouvement automatique (comme la description
// d'une course Strava) : visible par tous, modifiable par l'auteur seul.
export default function MovementNote({ activity, isMe, myId, T, onSaved, onAsset, onProfile }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [tags, setTags] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const note = activity.note;

  function startEdit() {
    setText(note || "");
    setTags(activity.note_tags || null);
    setError("");
    setEditing(true);
  }

  async function save() {
    const content = text.trim();
    const finalTags = content ? finalizeTags(content, tags) : null;
    setSaving(true); setError("");
    const { error: err } = await supabase.rpc("set_activity_note", { activity: String(activity.id), note_text: content, tags: finalTags });
    setSaving(false);
    if (err) { setError("Enregistrement impossible. Réessaie."); return; }
    // Prévient les membres nouvellement mentionnés
    const before = new Set((activity.note_tags?.mentions || []).map(m => m.id));
    for (const m of finalTags?.mentions || []) {
      if (m.id !== myId && !before.has(m.id)) await supabase.from("notifications").insert({ user_id: m.id, type: "mention", data: { activity_id: activity.id, excerpt: content.slice(0, 80) } });
    }
    onSaved({ ...activity, note: content || null, note_tags: finalTags });
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ marginBottom: 12 }}>
        <TagField as="textarea" value={text} onValueChange={setText} tags={tags} onTagsChange={setTags} myId={myId} T={T}
          autoFocus maxLength={1000} placeholder="Pourquoi ce mouvement ? Ta stratégie, ton ressenti… ($ valeur, @ membre)"
          style={{ minHeight: 70, resize: "vertical", padding: "9px 12px", fontSize: 14, lineHeight: 1.5, borderRadius: 10, border: `0.5px solid ${T.accent}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }} />
        {error && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        <RichText text={note} tickers={activity.note_tags?.tickers} mentions={activity.note_tags?.mentions} T={T} onAsset={onAsset} onProfile={onProfile} />
        {isMe && (
          <button onClick={startEdit} style={{ marginLeft: 8, background: "none", border: "none", padding: 0, fontSize: 12, color: T.textFaint, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>
        )}
      </div>
    );
  }

  if (!isMe) return null;
  return (
    <button onClick={startEdit}
      style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 12, padding: "8px 12px", borderRadius: 10, border: `0.5px dashed ${T.borderStrong}`, background: "none", fontSize: 13, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
      ✏️ Ajouter un commentaire sur ce mouvement
    </button>
  );
}
