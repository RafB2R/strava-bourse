import { useState, useRef, useCallback, useLayoutEffect } from "react";

// La fiche ouverte est aussi inscrite dans l'adresse (?fiche=<écran>:<données>) pour
// qu'une actualisation de la page la rouvre. « urlKey » distingue les écrans
// (marches, recherche, portefeuille) : seul celui qui l'a ouverte la rouvre.
function readFiche(urlKey) {
  try {
    const raw = new URLSearchParams(window.location.search).get("fiche");
    if (!raw || !raw.startsWith(`${urlKey}:`)) return null;
    return JSON.parse(raw.slice(urlKey.length + 1));
  } catch {
    return null;
  }
}

function writeFiche(value) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set("fiche", value); else params.delete("fiche");
  const qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
}

export function clearFicheFromUrl() {
  if (new URLSearchParams(window.location.search).has("fiche")) writeFiche(null);
}

// Fiche (ou autre écran de détail) ouverte à la place d'une liste : la position de
// défilement est mémorisée à l'ouverture et restaurée au retour, pour revenir
// exactement où l'on était (et pas en haut de la page).
// Options : urlKey pour garder la fiche dans l'adresse ; toUrl(view) → données à
// inscrire (petites), fromUrl(données) → fiche à rouvrir.
export function useDetailView({ urlKey, toUrl = v => v, fromUrl = d => d } = {}) {
  const [view, setView] = useState(() => {
    if (!urlKey) return null;
    const data = readFiche(urlKey);
    return data ? fromUrl(data) : null;
  });
  const saved = useRef(0);
  const restore = useRef(false);

  const open = useCallback(next => {
    saved.current = window.scrollY;
    setView(next);
    window.scrollTo(0, 0);
    if (urlKey) writeFiche(`${urlKey}:${JSON.stringify(toUrl(next))}`);
  }, [urlKey, toUrl]);

  const close = useCallback(() => {
    restore.current = true;
    setView(null);
    if (urlKey) writeFiche(null);
  }, [urlKey]);

  useLayoutEffect(() => {
    if (view !== null || !restore.current) return;
    restore.current = false;
    const y = saved.current;
    window.scrollTo(0, y);
    // Une seconde fois quand la liste a fini de se dessiner (cases rechargées…)
    requestAnimationFrame(() => window.scrollTo(0, y));
    const t = setTimeout(() => window.scrollTo(0, y), 250);
    return () => clearTimeout(t);
  }, [view]);

  return [view, open, close];
}
