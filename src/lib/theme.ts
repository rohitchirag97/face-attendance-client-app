/** Light, dark, or follow the device. Stored per browser; index.html applies it before the first paint. */
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export const getTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

export const isDark = (theme: Theme) => theme === "dark" || (theme === "system" && darkQuery().matches);

export const applyTheme = (theme: Theme) => {
  const dark = isDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
};

export const setTheme = (theme: Theme) => {
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this page view.
  }
  applyTheme(theme);
  window.dispatchEvent(new Event("theme-updated"));
};

/** Keeps "system" in step when the device switches between light and dark. Returns the unsubscribe. */
export const followSystemTheme = () => {
  const query = darkQuery();
  const onChange = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
