import type { ConfigPartial } from "artalk";
import type { Section } from "./config";

/** Public, JSON-serializable Artalk options. Page identity and DOM bindings belong to the integration. */
export type ArtalkClientOptions = Omit<
	ConfigPartial,
	| "el"
	| "server"
	| "site"
	| "pageKey"
	| "pageTitle"
	| "darkMode"
	| "locale"
	| "pageVote"
	| "pvEl"
	| "countEl"
	| "statPageKeyAttr"
	| "apiVersion"
	| "useBackendConf"
	| "avatarURLBuilder"
	| "imgUploader"
	| "markedReplacers"
	| "markedOptions"
	| "listFetchParamsModifier"
	| "dateFormatter"
	| "scrollRelativeTo"
	| "beforeSubmit"
>;

export interface ArtalkOptions {
	provider: "artalk";
	/** Public backend URL, e.g. https://comments.example.com or /comments. */
	server: string;
	/** Stable site name registered in Artalk. Defaults to the blog title. */
	site?: string;
	/** Defaults to both notes and jottings. */
	sections?: Section[];
	/** Defer client loading until the comment section is near the viewport. Default: true. */
	lazy?: boolean;
	/** Show comment and page-view counters. Default: true. */
	statistics?: boolean;
	/** Show article voting buttons. Default: true. */
	pageVote?: boolean;
	/** Enable the official Artalk KaTeX plugin. Default: true. */
	katex?: boolean;
	/** Zoom images in comments using the site's existing lightbox library. Default: true. */
	imageZoom?: boolean;
	/** Client options override Artalk dashboard defaults unless preferRemoteConf is true. No secrets. */
	options?: ArtalkClientOptions;
}

export interface ArtalkPage {
	section: Section;
	url: URL;
	title: string;
	locale: string;
	comments?: boolean;
	commentKey?: string;
}

export function artalkPageKey(url: URL, override?: string): string {
	if (override !== undefined) {
		if (!override.trim()) throw new Error("commentKey must not be empty");
		return override;
	}
	return url.pathname.replace(/\/+$/, "") || "/";
}

export function resolveArtalk(config: ArtalkOptions | false | undefined, siteTitle: string, page: ArtalkPage) {
	if (!config || page.comments === false || !(config.sections ?? ["note", "jotting"]).includes(page.section)) return;
	if (config.provider !== "artalk") throw new Error("Unsupported comment provider");
	const server = config.server.trim().replace(/\/+$/, "");
	if (!server || (!/^https?:\/\//.test(server) && !/^\/(?!\/)/.test(server))) {
		throw new Error("Artalk server must be an HTTP(S) URL or a root-relative path");
	}
	const endpoint = new URL(server, "https://example.invalid");
	if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
		throw new Error("Artalk server must not contain credentials, a query, or a fragment");
	}
	const site = config.site ?? siteTitle;
	if (!site.trim()) throw new Error("Artalk site must not be empty");
	const locale = { en: "en", "zh-cn": "zh-CN", ja: "ja" }[page.locale] ?? page.locale;
	// Fail clearly instead of silently discarding unsupported callback options during SSR serialization.
	JSON.stringify(config.options, (_key, value) => {
		if (["function", "symbol", "bigint"].includes(typeof value)) throw new Error("Artalk options must be JSON-serializable");
		return value;
	});
	return {
		client: {
			...config.options,
			server,
			site,
			pageKey: artalkPageKey(page.url, page.commentKey),
			pageTitle: page.title,
			locale
		},
		lazy: config.lazy ?? true,
		statistics: config.statistics ?? true,
		pageVote: config.pageVote ?? true,
		katex: config.katex ?? true,
		imageZoom: config.imageZoom ?? true
	};
}

export type ArtalkSettings = NonNullable<ReturnType<typeof resolveArtalk>>;
export type ArtalkReadyDetail = { artalk: import("artalk").default };
