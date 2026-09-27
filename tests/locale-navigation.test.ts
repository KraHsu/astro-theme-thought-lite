import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { ignoreCrossLocaleVisit } from "../src/lib/locale-navigation";

const slug = "强化学习的数学原理-2-贝尔曼公式";

function ignores(currentPath: string, lang: string, target: string, locales = ["en", "zh-cn"], defaultLocale = "zh-cn"): boolean {
	// Execute the serialized callback without module scope, as @swup/astro does.
	return vm.runInNewContext(`(${ignoreCrossLocaleVisit.toString()})(target)`, {
		// biome-ignore lint/style/useNamingConvention: Browser global exposed to the serialized callback.
		URL,
		target,
		window: { location: new URL(currentPath, "https://blog.krahsu.top") },
		document: { documentElement: { lang, dataset: { locales: locales.join(","), defaultLocale } } }
	});
}

test("article links between Chinese and English require full page navigation in both directions", () => {
	assert.equal(ignores(`/note/${slug}`, "zh-cn", `/en/note/${slug}`), true);
	assert.equal(ignores(`/en/note/${slug}`, "en", `/note/${slug}`), true);
	assert.equal(ignores(`/note/${slug}`, "zh-cn", `https://blog.krahsu.top/en/note/${encodeURIComponent(slug)}?from=note#action-value`), true);
});

test("same-language navigation, anchors and filters retain Swup transitions", () => {
	assert.equal(ignores(`/note/${slug}`, "zh-cn", "/note"), false);
	assert.equal(ignores(`/en/note/${slug}`, "en", "/en/note"), false);
	assert.equal(ignores(`/en/note/${slug}`, "en", "#action-value"), false);
	assert.equal(ignores("/en/note", "en", "?series=RL"), false);
});

test("locale detection matches whole path segments, including language homepages", () => {
	assert.equal(ignores("/", "zh-cn", "/en"), true);
	assert.equal(ignores("/", "zh-cn", "/en/"), true);
	assert.equal(ignores("/en", "en", "/"), true);
	assert.equal(ignores("/", "zh-cn", "/english-notes"), false);
	assert.equal(ignores("/", "zh-cn", "/note/en"), false);
});

test("the guard follows configured locales instead of hardcoding Chinese or English", () => {
	assert.equal(ignores("/note", "en", "/ja/note", ["en", "ja"], "en"), true);
	assert.equal(ignores("/ja/note", "ja", "/note", ["en", "ja"], "en"), true);
	assert.equal(ignores("/note", "en", "/about", ["en"], "en"), false);
	assert.equal(ignores("/note", "en", "https://example.org/note", ["en"], "en"), true);
});
