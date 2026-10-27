// Theme palette definitions and pure merge logic (localStorage > sheet config > defaults).

export const LIGHT_THEME = {
  mode: "light",
  bg: "#F5F4ED",
  surface: "#FAF9F5",
  surfaceElevated: "#FFFFFF",
  text: "#141413",
  textMuted: "#6B6960",
  accent: "#D97757",
  accentDark: "#C6613F",
  border: "#E3E0D3",
  success: "#2E7D4F",
  danger: "#C94A38"
};

export const DARK_THEME = {
  mode: "dark",
  bg: "#141413",
  surface: "#1E1E1C",
  surfaceElevated: "#282825",
  text: "#FAF9F5",
  textMuted: "#A6A397",
  accent: "#D97757",
  accentDark: "#C6613F",
  border: "#353430",
  success: "#48A86E",
  danger: "#E06350"
};

export const DEFAULT_THEME = LIGHT_THEME;

const KEY_ALIASES = {
  mode: "mode",
  theme_mode: "mode",
  bg: "bg",
  bg_color: "bg",
  background: "bg",
  surface: "surface",
  surface_color: "surface",
  surfaceElevated: "surfaceElevated",
  surface_elevated: "surfaceElevated",
  surface_elevated_color: "surfaceElevated",
  text: "text",
  text_color: "text",
  textMuted: "textMuted",
  text_muted: "textMuted",
  muted_color: "textMuted",
  accent: "accent",
  accent_color: "accent",
  accentDark: "accentDark",
  accent_dark: "accentDark",
  accent_dark_color: "accentDark",
   accent_hover_color: "accentDark",
  border: "border",
  border_color: "border",
  success: "success",
  success_color: "success",
  danger: "danger",
  danger_color: "danger"
};

/**
 * Normalises a raw config or theme override object into canonical theme properties,
 * omitting blank/null/undefined entries.
 * @param {Record<string, any>} [raw]
 * @returns {Partial<typeof LIGHT_THEME>}
 */
export function normaliseThemeLayer(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const result = {};
  for (const [k, v] of Object.entries(raw)) {
    const cleanKey = KEY_ALIASES[k.trim()];
    if (!cleanKey) continue;
    if (v === undefined || v === null) continue;
    const strVal = String(v).trim();
    if (!strVal) continue;
    result[cleanKey] = cleanKey === "mode" ? strVal.toLowerCase() : strVal;
  }
  return result;
}

/**
 * Pure function that merges theme settings with strict precedence:
 * localStorage > sheet config > defaults.
 *
 * Accepts either:
 *   mergeTheme({ defaults, sheet, local })
 * or positional:
 *   mergeTheme(defaults, sheet, local)
 *
 * @param {any} [arg1]
 * @param {any} [arg2]
 * @param {any} [arg3]
 */
export function mergeTheme(arg1 = {}, arg2 = {}, arg3 = {}) {
  let defaultsLayer;
  let sheetLayer;
  let localLayer;

  const isNamedOptions =
    arg1 &&
    typeof arg1 === "object" &&
    ("local" in arg1 || "sheet" in arg1 || "defaults" in arg1) &&
    Object.keys(arg2 || {}).length === 0 &&
    Object.keys(arg3 || {}).length === 0;

  if (isNamedOptions) {
    defaultsLayer = normaliseThemeLayer(arg1.defaults || LIGHT_THEME);
    sheetLayer = normaliseThemeLayer(arg1.sheet || {});
    localLayer = normaliseThemeLayer(arg1.local || {});
  } else {
    defaultsLayer = normaliseThemeLayer(arg1 || LIGHT_THEME);
    sheetLayer = normaliseThemeLayer(arg2 || {});
    localLayer = normaliseThemeLayer(arg3 || {});
  }

  const effectiveMode =
    localLayer.mode || sheetLayer.mode || defaultsLayer.mode || LIGHT_THEME.mode;
  const preset = effectiveMode === "dark" ? DARK_THEME : LIGHT_THEME;

  // When mode is explicitly switched to dark in local or sheet without custom colours in that layer,
  // start from the mode preset, then apply explicit overrides in precedence order.
  const base = {
    ...LIGHT_THEME,
    ...defaultsLayer,
    ...(effectiveMode === "dark" ? DARK_THEME : {})
  };

  return {
    ...base,
    ...defaultsLayer,
    ...(effectiveMode === "dark" && !localLayer.bg && !sheetLayer.bg ? DARK_THEME : {}),
    ...sheetLayer,
    ...localLayer,
    mode: effectiveMode === "dark" ? "dark" : "light"
  };
}

export const resolveTheme = mergeTheme;

/**
 * Maps a resolved theme object to CSS custom property declarations.
 * @param {typeof LIGHT_THEME} theme
 * @returns {Record<string, string>}
 */
export function themeToCssVars(theme = LIGHT_THEME) {
  return {
    "--bg": theme.bg || LIGHT_THEME.bg,
    "--surface": theme.surface || LIGHT_THEME.surface,
    "--surface-elevated": theme.surfaceElevated || LIGHT_THEME.surfaceElevated,
    "--text": theme.text || LIGHT_THEME.text,
    "--text-muted": theme.textMuted || LIGHT_THEME.textMuted,
    "--accent": theme.accent || LIGHT_THEME.accent,
    "--accent-dark": theme.accentDark || LIGHT_THEME.accentDark,
    "--border": theme.border || LIGHT_THEME.border,
    "--success": theme.success || LIGHT_THEME.success,
    "--danger": theme.danger || LIGHT_THEME.danger
  };
}
