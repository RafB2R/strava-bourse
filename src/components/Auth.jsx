import { useState } from "react";
import { supabase } from "../supabase";

const inp = { width: "100%", padding: "12px 14px", fontSize: 14, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", marginBottom: 12, display: "block" };
const btn = { width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit" };

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      if (!fullName.trim()) { setError("Entre ton prénom et nom."); setLoading(false); return; }
      if (!username.trim()) { setError("Entre un nom d'utilisateur."); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, full_name: fullName.trim(), username: username.trim().toLowerCase(), email });
      }
      setSuccess("Compte créé ! Vérifie ton email pour confirmer.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 6 }}>ve<span style={{ color: "#9FE1CB" }}>rio</span></div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
            {mode === "login" ? "Content de te revoir 👋" : "Rejoins la communauté 🌱"}
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "2rem" }}>

          <button onClick={handleGoogle} disabled={loading} style={{ ...btn, background: "#fff", color: "#111", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            Continuer avec Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>ou</span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
          </div>

          {mode === "register" && (
            <>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Prénom et nom</label>
              <input style={inp} placeholder="Raphaël Dupont" value={fullName} onChange={e => setFullName(e.target.value)} />
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Nom d'utilisateur</label>
              <input style={inp} placeholder="rafb2r" value={username} onChange={e => setUsername(e.target.value)} />
            </>
          )}

          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Email</label>
          <input style={inp} type="email" placeholder="toi@email.com" value={email} onChange={e => setEmail(e.target.value)} />

          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Mot de passe</label>
          <input style={{ ...inp, marginBottom: 16 }} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />

          {error && <div style={{ fontSize: 13, color: "#F08080", marginBottom: 12 }}>⚠️ {error}</div>}
          {success && <div style={{ fontSize: 13, color: "#9FE1CB", marginBottom: 12 }}>✅ {success}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{ ...btn, background: "#9FE1CB", color: "#0F6E56", marginBottom: 14 }}>
            {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>

          <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "#9FE1CB", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
