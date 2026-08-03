(() => {
  const storageKey = "nikke-sr-theme-v1";
  const validModes = new Set(["auto", "light", "dark"]);
  let mode = "auto";
  try {
    const savedMode = localStorage.getItem(storageKey);
    if (validModes.has(savedMode)) mode = savedMode;
  } catch { /* Theme still works for the current session when storage is unavailable. */ }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
})();
