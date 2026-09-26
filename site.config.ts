import siteConfig from "./src/lib/config";

const config = siteConfig({
	theme: {
		preset: "catppuccin",
		mode: "system"
	},
	title: "枢衡の巢",
	prologue: "We are all apprentices in a craft where no one ever becomes a master. \n—- Ernest Hemingway",
	author: {
		name: "KraHsu",
		email: "charles040318@gmail.mail",
		link: "https://blog.krahsu.top"
	},
	description: "KraHsu's personal blog",
	copyright: {
		type: "CC BY-NC-ND 4.0",
		year: "2025"
	},
	timezone: "Asia/Shanghai",
	i18n: {
		locales: ["en", "zh-cn"],
		defaultLocale: "zh-cn"
	},
	pagination: {
		note: 15,
		jotting: 24
	},
	heatmap: {
		unit: "day",
		weeks: 20
	},
	feed: {
		section: "*",
		limit: 20
	},
	latest: "*"
});

export const monolocale = Number(config.i18n.locales.length) === 1;

export default config;
