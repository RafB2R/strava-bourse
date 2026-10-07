import { useState, useRef, useCallback, useLayoutEffect } from "react";

// Fiche (ou autre écran de détail) ouverte à la place d'une liste : la position de
// défilement est mémorisée à l'ouverture et restaurée au retour, pour revenir
// exactement où l'on était (et pas en haut de la page).
export function useDetailView(initial = null) {
  const [view, setView] = useState(initial);
  const saved = useRef(0);
  const restore = useRef(false);

  const open = useCallback(next => {
    saved.current = window.scrollY;
    setView(next);
    window.scrollTo(0, 0);
  }, []);

  const close = useCallback(() => {
    restore.current = true;
    setView(null);
  }, []);

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
