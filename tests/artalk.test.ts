import assert from "node:assert/strict";
import { test } from "node:test";
import { artalkPageKey, resolveArtalk, type ArtalkOptions, type ArtalkPage } from "../src/lib/artalk";

const config: ArtalkOptions = { provider: "artalk", server: "https://comments.example.com/" };
const page: ArtalkPage = {
	section: "note",
	title: "A post",
	locale: "en",
	url: new URL("https://blog.example.com/note/post/?utm_source=test#comments")
};

test("comments are opt-in and respect site, section, and post switches", () => {
	assert.equal(resolveArtalk(undefined, "Blog", page), undefined);
	assert.equal(resolveArtalk(false, "Blog", { ...page, comments: true }), undefined);
	assert.equal(resolveArtalk(config, "Blog", { ...page, comments: false }), undefined);
	assert.equal(resolveArtalk({ ...config, sections: [] }, "Blog", page), undefined);
	assert.equal(resolveArtalk({ ...config, sections: ["jotting"] }, "Blog", page), undefined);
	assert.ok(resolveArtalk(config, "Blog", { ...page, section: "jotting" }));
});

test("thread identity survives domain, title, query, hash, and trailing slash changes", () => {
	const first = resolveArtalk(config, "Blog", page)!;
	const second = resolveArtalk(config, "Blog", { ...page, title: "Renamed", url: new URL("https://new.example.com/note/post") })!;
	assert.equal(first.client.pageKey, "/note/post");
	assert.equal(first.client.pageKey, second.client.pageKey);
	assert.equal(second.client.pageTitle, "Renamed");
	assert.equal(artalkPageKey(new URL("https://example.com")), "/");
});

test("translations are separate unless explicitly assigned the same legacy key", () => {
	assert.equal(artalkPageKey(new URL("https://example.com/ja/note/post")), "/ja/note/post");
	const key = "https://old.example.com/post/";
	assert.equal(resolveArtalk(config, "Blog", { ...page, commentKey: key })!.client.pageKey, key);
	assert.equal(resolveArtalk(config, "Blog", { ...page, locale: "ja", commentKey: key })!.client.pageKey, key);
	assert.throws(() => artalkPageKey(page.url, "  "), /empty/);
});

test("maps supported locales and preserves explicit stable site identity", () => {
	for (const [input, expected] of [
		["en", "en"],
		["zh-cn", "zh-CN"],
		["ja", "ja"]
	]) {
		assert.equal(resolveArtalk(config, "Blog", { ...page, locale: input })!.client.locale, expected);
	}
	assert.equal(resolveArtalk(config, "Blog", page)!.client.site, "Blog");
	assert.equal(resolveArtalk({ ...config, site: "Stable" }, "Renamed", page)!.client.site, "Stable");
});

test("accepts proxied paths and rejects credential-bearing or malformed endpoint configuration", () => {
	assert.equal(resolveArtalk({ ...config, server: "/comments-api/" }, "Blog", page)!.client.server, "/comments-api");
	for (const server of ["", "javascript:alert(1)", "//host", "api", "https://user:secret@host", "https://host?key=secret", "https://host#part"]) {
		assert.throws(() => resolveArtalk({ ...config, server }, "Blog", page));
	}
	assert.throws(() => resolveArtalk({ ...config, site: " " }, "Blog", page), /empty/);
});

test("preserves Artalk options and explicit false toggles through HTML serialization", () => {
	const result = resolveArtalk(
		{
			...config,
			lazy: false,
			statistics: false,
			pageVote: false,
			katex: false,
			imageZoom: false,
			options: { pvAdd: false, emoticons: false, preferRemoteConf: true, pagination: { pageSize: 5 }, voteDown: true }
		},
		"Blog",
		page
	)!;
	assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
	for (const key of ["lazy", "statistics", "pageVote", "katex", "imageZoom"] as const) assert.equal(result[key], false);
	assert.equal(result.client.pvAdd, false);
	assert.equal(result.client.preferRemoteConf, true);
	assert.equal(result.client.pagination?.pageSize, 5);
});

test("fails clearly for callbacks instead of silently dropping them", () => {
	const options = { beforeSubmit: () => true } as unknown as ArtalkOptions["options"];
	assert.throws(() => resolveArtalk({ ...config, options }, "Blog", page), /JSON-serializable/);
});
