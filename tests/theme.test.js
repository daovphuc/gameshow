import test from "node:test";
import assert from "node:assert/strict";
import { LIGHT_THEME, DARK_THEME, mergeTheme, themeToCssVars } from "../js/theme.js";

test("mergeTheme enforces precedence: localStorage > sheet config > defaults", () => {
  const defaults = {
    ...LIGHT_THEME,
    bg: "#F5F4ED",
    accent: "#D97757",
    text: "#141413"
  };

  const sheetConfig = {
    bg_color: "#EFECE6",
    accent_color: "#2E7D4F"
  };

  const localOverrides = {
    accent: "#B85C38"
  };

  // 1. Defaults only
  const fromDefaults = mergeTheme({ defaults, sheet: {}, local: {} });
  assert.equal(fromDefaults.bg, "#F5F4ED");
  assert.equal(fromDefaults.accent, "#D97757");
  assert.equal(fromDefaults.text, "#141413");

  // 2. Sheet overrides defaults
  const fromSheet = mergeTheme({ defaults, sheet: sheetConfig, local: {} });
  assert.equal(fromSheet.bg, "#EFECE6");
  assert.equal(fromSheet.accent, "#2E7D4F");
  assert.equal(fromSheet.text, "#141413");

  // 3. Local overrides sheet and defaults
  const fromLocal = mergeTheme({ defaults, sheet: sheetConfig, local: localOverrides });
  assert.equal(fromLocal.bg, "#EFECE6");     // from sheet (local didn't set bg)
  assert.equal(fromLocal.accent, "#B85C38"); // from local (wins over sheet & defaults)
  assert.equal(fromLocal.text, "#141413");   // from defaults

  // Also works with positional arguments (defaults, sheet, local)
  const positional = mergeTheme(defaults, sheetConfig, localOverrides);
  assert.deepEqual(positional, fromLocal);
});

test("mergeTheme supports dark mode preset and CSS custom property mapping", () => {
  const darkResolved = mergeTheme({
    defaults: LIGHT_THEME,
    sheet: {},
    local: { mode: "dark" }
  });
  assert.equal(darkResolved.mode, "dark");
  assert.equal(darkResolved.bg, DARK_THEME.bg);
  assert.equal(darkResolved.text, DARK_THEME.text);
  assert.equal(darkResolved.accent, DARK_THEME.accent);

  const vars = themeToCssVars(darkResolved);
  assert.equal(vars["--bg"], DARK_THEME.bg);
  assert.equal(vars["--accent"], "#D97757");
});
