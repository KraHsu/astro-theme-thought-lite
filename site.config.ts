import siteConfig from "./src/utils/config";

const config = siteConfig({
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
	i18n: {
		locales: ["en", "zh-cn"],
		defaultLocale: "zh-cn"
	},
	feed: {
		section: "*",
		limit: 20
	},
	latest: "*"
});

export const monolocale = Number(config.i18n.locales.length) === 1;

export default config;
