/** Runs before paint: applies the stored theme choice so there is no flash (light | dark | system). */
export const THEME_STORAGE_KEY = "ly-theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
