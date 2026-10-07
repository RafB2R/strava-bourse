import { useState } from "react";
import { supabase } from "../supabase";
import { RichText, TagField } from "./PostText";
import { finalizeTags } from "../tags";

// Description de l'auteur sous un mouvement automatique (comme celle d'une course
// Strava) : visible par tous, modifiable par l'auteur seul.
// L'édition s'ouvre depuis le bouton « ✏️ Ajouter une description » de la ligne
// d'actions (géré par le parent) ou depuis « Modifier » : « editing » et
// « onEditingChange » sont contrôlés par le parent.
export default function MovementNote({ activity, isMe, myId, T, onSaved, onAsset, onProfile, editing, onEditingChange }) {
  if (editing) {
    return (
      <NoteEditor activity={activity} myId={myId} T={T}
        onCancel={() => onEditingChange(false)}
        onSaved={updated => { onSaved(updated); onEditingChange(false); }} />
    );
  }
  if (!activity.note) return null;
  return (
    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      <RichText text={activity.note} tickers={activity.note_tags?.tickers} mentions={activity.note_tags?.mentions} T={T} onAsset={onAsset} onProfile={onProfile} />
      {isMe && (
        <button onClick={() => onEditingChange(true)} style={{ marginLeft: 8, background: "none", border: "none", padding: 0, fontSize: 12, color: T.textFaint, cursor: "pointer", fontFamily: "inherit" }}>✏️ Modifier</button>
      )}
    </div>
  );
}

// Zone de saisie, montée à chaque ouverture : elle part de la description actuelle
function NoteEditor({ activity, myId, T, onCancel, onSaved }) {
  const [text, setText] = useState(activity.note || "");
  const [tags, setTags] = useState(activity.note_tags || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <TagField as="textarea" value={text} onValueChange={setText} tags={tags} onTagsChange={setTags} myId={myId} T={T}
        autoFocus maxLength={1000} placeholder="Pourquoi ce mouvement ? Ta stratégie, ton ressenti… ($ valeur, @ membre)"
        style={{ minHeight: 70, resize: "vertical", padding: "9px 12px", fontSize: 14, lineHeight: 1.5, borderRadius: 10, border: `0.5px solid ${T.accent}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }} />
      {error && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={{ background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "…" : "Enregistrer"}</button>
      </div>
    </div>
  );
}
