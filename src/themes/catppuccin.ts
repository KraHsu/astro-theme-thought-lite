import thoughtLite from "./thought-lite";
import type { ThemeDefinition } from "./types";

/** Catppuccin Latte / Mocha palette. */
export default {
	...thoughtLite,
	name: "catppuccin",
	colors: {
		light: {
			primary: "#4c4f69",
			secondary: "#6c6f85",
			weak: "#9ca0b0",
			background: "#eff1f5",
			block: "#e6e9ef",
			shadow: "#ccd0da",
			selection: "#acb0be80",
			accent: "#40a02b",
			link: "#209fb5",
			heatmap: "#40a02b",
			success: "#40a02b",
			info: "#1e66f5",
			warning: "#df8e1d",
			danger: "#d20f39",
			codeBackground: "#e6e9ef"
		},
		dark: {
			primary: "#cdd6f4",
			secondary: "#a6adc8",
			weak: "#6c7086",
			background: "#1e1e2e",
			block: "#181825",
			shadow: "#313244",
			selection: "#585b7080",
			accent: "#a6e3a1",
			link: "#74c7ec",
			heatmap: "#a6e3a1",
			success: "#a6e3a1",
			info: "#89b4fa",
			warning: "#f9e2af",
			danger: "#f38ba8",
			codeBackground: "#181825"
		}
	},
	code: { light: "catppuccin-latte", dark: "catppuccin-mocha" }
} satisfies ThemeDefinition;
