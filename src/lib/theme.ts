import thoughtLite from "../themes/thought-lite";
import catppuccin from "../themes/catppuccin";
import type { ColorMode, ThemeColors, ThemeDefinition, ThemeOverrides } from "../themes/types";

export type { ColorMode, ColorScheme, ThemeColors, ThemeDefinition, ThemeOverrides } from "../themes/types";

const presets = { "thought-lite": thoughtLite, catppuccin };
export type ThemePreset = keyof typeof presets;

export interface ThemeOptions extends ThemeOverrides {
	preset?: ThemePreset | ThemeDefinition;
	/** Initial preference; a visitor's saved light/dark choice takes priority. */
	mode?: ColorMode;
	/** Hide the visitor's light/dark switch without changing the mode. */
	showToggle?: boolean;
}

/** Optional values from environment-driven configuration must keep their defaults. */
function mergeDefined<T extends object>(base: T, overrides?: Partial<T>): T {
	const values = Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined);
	return { ...base, ...Object.fromEntries(values) };
}

function mergeTheme(base: ThemeDefinition, overrides: ThemeOverrides): ThemeDefinition {
	return {
		name: base.name,
		colors: {
			light: mergeDefined(base.colors.light, overrides.colors?.light),
			dark: mergeDefined(base.colors.dark, overrides.colors?.dark)
		},
		fonts: mergeDefined(base.fonts, overrides.fonts),
		layout: mergeDefined(base.layout, overrides.layout),
		code: mergeDefined(base.code, overrides.code)
	};
}

function getPreset(preset: ThemeOptions["preset"] = "thought-lite"): ThemeDefinition {
	if (typeof preset !== "string") return preset;
	if (!Object.hasOwn(presets, preset)) throw new Error(`Unknown theme preset: ${preset}`);
	return presets[preset];
}

/** Create a portable theme module without registering it in core code. */
export function defineTheme(options: ThemeOverrides & { name: string; extends?: ThemeOptions["preset"] }): ThemeDefinition {
	return { ...mergeTheme(getPreset(options.extends), options), name: options.name };
}

export function resolveTheme(options: ThemeOptions = {}) {
	const mode = options.mode ?? "system";
	if (!["light", "dark", "system"].includes(mode)) throw new Error(`Unknown theme mode: ${mode}`);
	return { ...mergeTheme(getPreset(options.preset), options), mode, showToggle: options.showToggle ?? true };
}

/** Config is build-time input. Reject values that could escape a CSS declaration/style tag. */
function cssValue(value: string | number): string {
	const text = String(value);
	if (!text.trim() || /[;{}<>]|\/\*/.test(text)) throw new Error(`Invalid theme CSS value: ${text}`);
	return text;
}

function colorCSS(colors: ThemeColors) {
	return Object.entries(colors)
		.map(([key, value]) => `--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-color:${cssValue(value)};`)
		.join("");
}

/** Render once in the document head, before first paint, including a no-JS system fallback. */
export function themeCSS(theme: ReturnType<typeof resolveTheme>): string {
	const light = `color-scheme:light;${colorCSS(theme.colors.light)}`;
	const dark = `color-scheme:dark;${colorCSS(theme.colors.dark)}`;
	const { fonts, layout } = theme;
	return [
		`:root{--font-body:${cssValue(fonts.body)};--font-mono:${cssValue(fonts.mono)};--font-cursive:${cssValue(fonts.display)};--content-width:${cssValue(layout.contentWidth)};--body-font-size:${cssValue(layout.fontSize)};--mobile-font-size:${cssValue(layout.mobileFontSize)};--markdown-line-height:${cssValue(layout.lineHeight)};}`,
		`:root{${theme.mode === "dark" ? dark : light}}`,
		theme.mode === "system" ? `@media(prefers-color-scheme:dark){:root:not([data-theme]){${dark}}}` : "",
		`:root[data-theme="light"]{${light}}`,
		`:root[data-theme="dark"]{${dark}}`
	].join("\n");
}
