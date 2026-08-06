export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const DEFAULT_THEME: ThemeChoice = "system";

export const THEME_META: Record<ThemeChoice, { label: string; hint: string }> = {
  system: { label: "System", hint: "follows your device setting" },
  light: { label: "Light", hint: "always light" },
  dark: { label: "Dark", hint: "always dark" },
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

export const THEME_STORAGE_KEY = "ratat:theme";

/**
 * Runs from an inline script before first paint, so a device set to light on a
 * dark system never flashes the wrong theme. Everything else in quick settings
 * can wait for React; a whole page changing colour cannot.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
