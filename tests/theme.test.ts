import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { parse } from "css-tree";
import { defineTheme, resolveTheme, themeCSS, type ThemePreset } from "../src/lib/theme";

test("omitting theme config preserves original palette, layout and highlighting", () => {
	const theme = resolveTheme();
	assert.equal(theme.name, "thought-lite");
	assert.equal(theme.colors.light.background, "#fffffd");
	assert.equal(theme.colors.dark.primary, "#dddddb");
	assert.equal(theme.layout.contentWidth, "1000px");
	assert.deepEqual(theme.code, { light: "github-light", dark: "dark-plus" });
	assert.equal(theme.mode, "system");
	assert.equal(theme.showToggle, true);
});

test("portable themes inherit presets and merge partial overrides without changing the base", () => {
	const custom = defineTheme({
		name: "my-theme",
		extends: "catppuccin",
		colors: { light: { accent: "#123456" } },
		fonts: { body: "system-ui, sans-serif" }
	});
	const theme = resolveTheme({ preset: custom, colors: { dark: { background: "#101010" } }, layout: { contentWidth: "72rem" } });
	assert.equal(theme.name, "my-theme");
	assert.equal(theme.colors.light.accent, "#123456");
	assert.equal(theme.colors.light.background, "#eff1f5");
	assert.equal(theme.colors.dark.background, "#101010");
	assert.equal(theme.code.dark, "catppuccin-mocha");
	assert.equal(theme.fonts.body, "system-ui, sans-serif");
	assert.equal(custom.colors.dark.background, "#1e1e2e");
	assert.equal(resolveTheme({ preset: "catppuccin" }).colors.light.accent, "#40a02b");
	assert.equal(resolveTheme().layout.contentWidth, "1000px");
});

test("undefined optional overrides retain inherited values instead of emitting invalid CSS", () => {
	const custom = defineTheme({
		name: "optional-settings",
		extends: "catppuccin",
		colors: { light: { background: undefined } },
		fonts: { body: undefined },
		layout: { contentWidth: undefined },
		code: { light: undefined }
	});
	const theme = resolveTheme({
		preset: custom,
		colors: { dark: { primary: undefined } },
		layout: { lineHeight: undefined }
	});
	const base = resolveTheme({ preset: "catppuccin" });
	assert.deepEqual(theme.colors, base.colors);
	assert.deepEqual(theme.fonts, base.fonts);
	assert.deepEqual(theme.layout, base.layout);
	assert.deepEqual(theme.code, base.code);
	assert.equal(themeCSS(theme), themeCSS(base));
});

test("CSS supports no-JS system mode and explicit schemes, rejects style-tag escapes", () => {
	const css = themeCSS(resolveTheme({ preset: "catppuccin" }));
	assert.doesNotThrow(() => parse(css));
	assert.match(css, /@media\(prefers-color-scheme:dark\)/);
	assert.match(css, /:root\[data-theme="dark"\]\{color-scheme:dark;--primary-color:#cdd6f4/);
	assert.match(themeCSS(resolveTheme({ mode: "dark" })), /:root\{color-scheme:dark/);
	assert.doesNotMatch(themeCSS(resolveTheme({ mode: "light" })), /@media/);
	assert.throws(() => themeCSS(resolveTheme({ fonts: { body: "</style><script>" } })), /Invalid theme CSS/);
	assert.throws(() => resolveTheme({ preset: "missing" as ThemePreset }), /Unknown theme preset/);
});

test("the selected preset reaches Astro's real Markdown/Shiki pipeline", async () => {
	const processor = await createMarkdownProcessor({ shikiConfig: { themes: resolveTheme({ preset: "catppuccin" }).code } });
	const result = await processor.render("```js\nconst answer = 42;\n```");
	assert.match(result.code, /catppuccin-latte/);
	assert.match(result.code, /catppuccin-mocha/);
	assert.match(result.code, /--shiki-dark/);
});

const initScript = readFileSync(new URL("../src/scripts/theme-init.js", import.meta.url), "utf8");

function browser({
	mode = "system",
	saved = null,
	dark = false,
	blocked = false
}: {
	mode?: string;
	saved?: string | null;
	dark?: boolean;
	blocked?: boolean;
} = {}) {
	const dataset: Record<string, string> = { colorMode: mode };
	const listeners: Record<string, (event?: any) => void> = {};
	const media = { matches: dark, addEventListener: (name: string, fn: () => void) => (listeners[name] = fn) };
	let writes = 0;
	vm.runInNewContext(initScript, {
		document: { documentElement: { dataset }, addEventListener: (name: string, fn: () => void) => (listeners[name] = fn) },
		window: { matchMedia: () => media, addEventListener: (name: string, fn: () => void) => (listeners[name] = fn) },
		localStorage: {
			getItem: () => {
				if (blocked) throw new Error("Storage blocked");
				return saved;
			},
			setItem: () => writes++
		}
	});
	return { dataset, listeners, media, writes: () => writes };
}

test("first paint follows OS without persisting an automatic preference", () => {
	const page = browser({ dark: true });
	assert.equal(page.dataset.theme, "dark");
	assert.equal(page.writes(), 0);
	page.media.matches = false;
	page.listeners.change();
	assert.equal(page.dataset.theme, "light");
});

test("visitor selection wins over site default and future OS changes", () => {
	const page = browser({ mode: "light", saved: "dark" });
	assert.equal(page.dataset.theme, "dark");
	page.listeners.change();
	assert.equal(page.dataset.theme, "dark");
	page.listeners["thought-lite:scheme"]({ detail: "light" });
	page.media.matches = true;
	page.listeners.change();
	assert.equal(page.dataset.theme, "light");
});

test("blocked storage, invalid saved values, fixed modes, and cross-tab reset remain usable", () => {
	assert.equal(browser({ blocked: true, dark: true }).dataset.theme, "dark");
	assert.equal(browser({ saved: "invalid", mode: "dark" }).dataset.theme, "dark");
	const fixed = browser({ mode: "light", dark: true });
	fixed.listeners.change();
	assert.equal(fixed.dataset.theme, "light");
	const page = browser({ saved: "light", dark: true });
	page.listeners.storage({ key: "theme", newValue: null });
	assert.equal(page.dataset.theme, "dark");
	page.listeners.storage({ key: "theme", newValue: "light" });
	assert.equal(page.dataset.theme, "light");
	page.listeners.storage({ key: null, newValue: null });
	assert.equal(page.dataset.theme, "dark");
});
