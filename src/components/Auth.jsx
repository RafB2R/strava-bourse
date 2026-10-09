import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { T as TLive } from "../theme";
import { normalizeUsername, usernameFormatError, isUsernameAvailable } from "../usernames";
import Icon from "./Icon";
import Logo from "./Logo";
import { t } from "../i18n";

const inp = (T) => ({ width: "100%", padding: "12px 14px", fontSize: 14, borderRadius: 10, border: `0.5px solid ${T.borderStrong}`, background: T.bgCard, color: T.text, fontFamily: "inherit", marginBottom: 12, display: "block" });
const btn = { width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit" };

export default function Auth({ T: TProp }) {
  const T = TProp || TLive;
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Disponibilité du pseudo : { name, available } pour le dernier pseudo vérifié
  const [check, setCheck] = useState(null);
  const cleanUsername = normalizeUsername(username);
  const formatError = username ? usernameFormatError(username) : null;

  // Vérifie le pseudo 400 ms après la dernière frappe
  useEffect(() => {
    if (mode !== "register" || !cleanUsername || usernameFormatError(cleanUsername)) return;
    let ignore = false;
    const timer = setTimeout(() => {
      isUsernameAvailable(cleanUsername).then(available => { if (!ignore) setCheck({ name: cleanUsername, available }); });
    }, 400);
    return () => { ignore = true; clearTimeout(timer); };
  }, [mode, cleanUsername]);

  const status = !username ? null
    : formatError ? { ok: false, text: formatError }
    : check?.name !== cleanUsername ? { ok: null, text: t("Vérification…") }
    : check.available === true ? { ok: true, text: t("@{name} est disponible", { name: cleanUsername }) }
    : check.available === false ? { ok: false, text: t("@{name} est déjà pris", { name: cleanUsername }) }
    : null;

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
      if (!fullName.trim()) { setError(t("Entre ton prénom et nom.")); setLoading(false); return; }
      if (!username.trim()) { setError(t("Entre un nom d'utilisateur.")); setLoading(false); return; }
      if (formatError) { setError(t("Nom d'utilisateur : {error}", { error: formatError.toLowerCase() })); setLoading(false); return; }
      if (await isUsernameAvailable(cleanUsername) === false) { setError(t("@{name} est déjà pris, choisis-en un autre.", { name: cleanUsername })); setLoading(false); return; }
      // Le profil est créé côté serveur à partir de ces métadonnées (trigger verio_create_profile)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim(), username: cleanUsername } },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSuccess(t("Compte créé ! Vérifie ton email pour confirmer."));
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', system-ui, sans-serif", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ marginBottom: 8 }}><Logo size={30} color={T.text} accent={T.accent} /></div>
          <div style={{ fontSize: 14, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {mode === "login" ? t("Content de te revoir") : t("Rejoins la communauté")}<Icon name={mode === "login" ? "hand" : "leaf"} size={15} />
          </div>
        </div>

        <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: "2rem" }}>

          <button onClick={handleGoogle} disabled={loading} style={{ ...btn, background: T.text, color: T.bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            {t("Continuer avec Google")}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: "0.5px", background: T.border }} />
            <span style={{ fontSize: 12, color: T.textFaint }}>{t("ou")}</span>
            <div style={{ flex: 1, height: "0.5px", background: T.border }} />
          </div>

          {mode === "register" && (
            <>
              <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Prénom et nom")}</label>
              <input style={inp(T)} placeholder={t("Raphaël Dupont")} value={fullName} onChange={e => setFullName(e.target.value)} />
              <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Nom d'utilisateur")}</label>
              <input style={{ ...inp(T), marginBottom: status ? 4 : 12, borderColor: status?.ok === false ? T.red : status?.ok ? T.accent : T.borderStrong }}
                placeholder="rafb2r" value={username} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={21}
                aria-invalid={status?.ok === false} aria-describedby="username-status"
                onChange={e => setUsername(e.target.value.replace(/\s/g, ""))} />
              {status && (
                <div id="username-status" role="status" style={{ fontSize: 12, marginBottom: 12, color: status.ok === false ? T.red : status.ok ? T.accent : T.textFaint, display: "flex", alignItems: "center", gap: 5 }}>
                  {status.ok === true ? <Icon name="check" size={13} /> : status.ok === false ? <Icon name="close" size={13} /> : null}{status.text}
                </div>
              )}
            </>
          )}

          <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Email")}</label>
          <input style={inp(T)} type="email" placeholder={t("toi@email.com")} value={email} onChange={e => setEmail(e.target.value)} />

          <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>{t("Mot de passe")}</label>
          <input style={{ ...inp(T), marginBottom: 16 }} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />

          {error && <div style={{ fontSize: 13, color: T.red, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon name="warning" size={14} />{error}</div>}
          {success && <div style={{ fontSize: 13, color: T.accent, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon name="ok" size={14} />{success}</div>}

          <button onClick={handleSubmit} disabled={loading || (mode === "register" && status?.ok === false)} style={{ ...btn, background: T.accent, color: T.onAccent, marginBottom: 14, opacity: mode === "register" && status?.ok === false ? 0.5 : 1 }}>
            {loading ? t("Chargement…") : mode === "login" ? t("Se connecter") : t("Créer mon compte")}
          </button>

          <div style={{ textAlign: "center", fontSize: 13, color: T.textMuted }}>
            {mode === "login" ? t("Pas encore de compte ?") : t("Déjà un compte ?")}{" "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              {mode === "login" ? t("S'inscrire") : t("Se connecter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
