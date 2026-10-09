import { useEffect, useRef } from "react";

// Rafraîchissement régulier qui s'arrête quand l'appli n'est pas à l'écran (onglet en
// arrière-plan, téléphone verrouillé) et reprend aussitôt au retour.
// « fn » est appelée tout de suite, puis toutes les « ms » tant que la page est visible.
// « enabled » : false pour ne rien faire (pas connecté, autre composant qui s'en charge…).
export function useVisibleInterval(fn, ms, deps = [], enabled = true) {
  const latest = useRef(fn);
  useEffect(() => { latest.current = fn; });
  useEffect(() => {
    if (!enabled) return;
    let timer = null;
    const run = () => latest.current();
    const start = () => { if (!timer) timer = setInterval(run, ms); };
    const stop = () => { clearInterval(timer); timer = null; };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { run(); start(); }
    };
    run();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, ...deps]);
}
