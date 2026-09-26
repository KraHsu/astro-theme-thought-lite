import Artalk from "artalk";
import "artalk/i18n/ja";
import artalkStyles from "artalk/Artalk.css?url";
import themeStyles from "../styles/artalk.css?url";

function loadStylesheet(href: string) {
	if (document.querySelector<HTMLLinkElement>(`link[data-artalk-style][href="${href}"]`)?.sheet) return Promise.resolve();
	return new Promise<void>((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		link.dataset.artalkStyle = "";
		link.onload = () => resolve();
		link.onerror = () => {
			link.remove();
			reject(new Error(`Could not load Artalk stylesheet: ${href}`));
		};
		document.head.append(link);
	});
}

export default async function loadArtalk() {
	// URL imports keep Astro from hoisting these styles onto pages with comments disabled.
	// Link insertion order ensures the site's palette overrides Artalk's defaults.
	await Promise.all([loadStylesheet(artalkStyles), loadStylesheet(themeStyles)]);
	return Artalk;
}
