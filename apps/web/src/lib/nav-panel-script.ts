/** localStorage: the viewer's choice for the dashboard's section panel, "open" or "folded" (ADR 0063). */
export const NAV_PANEL_STORAGE_KEY = "linkyo.navPanel";

/**
 * Runs before paint, after the theme script: copies the stored choice to `<html data-nav-panel>`, so
 * the server-rendered splash and the shell lay out the frame from the first paint (the `nav-folded:`
 * variant) and nothing shifts when the shell mounts. Anything else stored, or storage that throws
 * (private mode, blocked site data), leaves the attribute off: the panel is open.
 */
export const navPanelInitScript = `(function(){try{var v=localStorage.getItem("${NAV_PANEL_STORAGE_KEY}");if(v==="folded"||v==="open"){document.documentElement.dataset.navPanel=v;}}catch(e){}})();`;
