export const THEME_STORAGE_KEY = "nikke-sr-theme-v1";
const modes = new Set(["auto", "light", "dark"]);
const themeMediaQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
export function applyThemeMode(requestedMode: string | undefined, persist = false) {
  const mode = requestedMode && modes.has(requestedMode) ? requestedMode : "auto";
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = mode === "auto" ? (themeMediaQuery().matches ? "dark" : "light") : mode;
  document.querySelectorAll<HTMLButtonElement>(".theme-option[data-theme-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeMode === mode));
  });
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* Session-only theme. */ }
  }
}
export function initializeTheme() {
  let mode = "auto";
  try { mode = localStorage.getItem(THEME_STORAGE_KEY) ?? mode; } catch { /* Session-only theme. */ }
  applyThemeMode(mode);
}
export function bindTheme() {
  applyThemeMode(document.documentElement.dataset.themeMode);
  document.querySelectorAll<HTMLButtonElement>(".theme-option[data-theme-mode]").forEach((button) => {
    button.addEventListener("click", () => applyThemeMode(button.dataset.themeMode, true));
  });
  const handleChange = () => {
    if (document.documentElement.dataset.themeMode === "auto") applyThemeMode("auto");
  };
  const media = themeMediaQuery();
  if (typeof media.addEventListener === "function") media.addEventListener("change", handleChange);
  else media.addListener(handleChange);
}
