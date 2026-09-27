/**
 * Swup only replaces <main>; a locale change must also reload the page shell.
 * Keep this callback self-contained: @swup/astro serializes it into the browser.
 */
export function ignoreCrossLocaleVisit(url: string): boolean {
	const { locales, defaultLocale } = document.documentElement.dataset;
	if (!locales || !defaultLocale) return false;

	const target = new URL(url, window.location.href);
	const prefix = target.pathname.split("/")[1];
	const targetLocale = locales.split(",").find(locale => locale === prefix) ?? defaultLocale;

	return target.origin !== window.location.origin || targetLocale !== document.documentElement.lang;
}
