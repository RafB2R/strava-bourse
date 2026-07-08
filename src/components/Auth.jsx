import { useState } from "react";
import { supabase } from "../supabase";

const inp = { width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", marginBottom: 12, display: "block" };
const btn = { width: "100%", padding: 13, fontSize: 14, borderRadius: 10, border: "none", background: "#9FE1CB", color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const link = { background: "none", border: "none", color: "#9FE1CB", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 14, display: "block", textAlign: "center" };

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSignup() {
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, full_name: fullName, username: username.toLowerCase().trim(), city: "" });
    }
    setMessage("Vérifie tes emails pour confirmer ton compte !");
    setLoading(false);
  }

  if (message) return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Email envoyé !</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{message}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "2rem", maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 4 }}>ve<span style={{ color: "#9FE1CB" }}>rio</span></div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{mode === "login" ? "Content de te revoir !" : "Rejoins la communauté"}</div>
        </div>

        {mode === "signup" && (
          <>
            <input style={inp} placeholder="Prénom et nom" value={fullName} onChange={e => setFullName(e.target.value)} />
            <input style={inp} placeholder="Nom d'utilisateur (ex: thomasm)" value={username} onChange={e => setUsername(e.target.value)} />
          </>
        )}
        <input style={inp} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inp} placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        {error && <div style={{ fontSize: 13, color: "#F08080", marginBottom: 12 }}>⚠️ {error}</div>}

        <button style={btn} onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading}>
          {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
        <button style={link} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  );
}
