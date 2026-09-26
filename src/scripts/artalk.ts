import type Artalk from "artalk";
import type { Zoom } from "medium-zoom";
import type { ArtalkReadyDetail, ArtalkSettings } from "../lib/artalk";

let client: Promise<typeof Artalk> | undefined;
let math: Promise<void> | undefined;
let instanceId = 0;
let imageZoom: Zoom | undefined;

function loadClient() {
	return (client ??= import("./artalk-client")
		.then(({ default: loadArtalk }) => loadArtalk())
		.catch(error => {
			client = undefined;
			throw error;
		}));
}

/** A custom element follows Swup DOM replacement as well as normal Astro navigation. */
class ArtalkComments extends HTMLElement {
	private instance?: Artalk;
	private zoom?: Zoom;
	private visibility?: IntersectionObserver;
	private scheme?: MutationObserver;
	private votes?: MutationObserver;
	private mountError?: MutationObserver;
	private generation = 0;
	private loading = false;
	private settings!: ArtalkSettings;

	connectedCallback() {
		this.generation++;
		this.dataset.artalkInstance = String(++instanceId);
		this.settings = JSON.parse(this.dataset.settings!);
		this.querySelector<HTMLButtonElement>("[data-artalk-retry]")!.onclick = () => this.start();
		if (this.settings.lazy && "IntersectionObserver" in window) {
			this.visibility = new IntersectionObserver(
				entries => {
					if (entries.some(entry => entry.isIntersecting)) void this.start();
				},
				{ rootMargin: "200px" }
			);
			this.visibility.observe(this);
		} else void this.start();
	}

	private async start() {
		if (this.loading || this.instance) return;
		this.visibility?.disconnect();
		this.loading = true;
		const generation = this.generation;
		const status = this.querySelector<HTMLElement>("[data-artalk-status]")!;
		const retry = this.querySelector<HTMLButtonElement>("[data-artalk-retry]")!;
		retry.hidden = true;
		try {
			const Artalk = await loadClient();
			if (this.settings.katex) {
				await (math ??= import("@artalk/plugin-katex")
					.then(({ ArtalkKatexPlugin }) => Artalk.use(ArtalkKatexPlugin))
					.catch(error => {
						math = undefined;
						throw error;
					}));
			}
			const mediumZoom = this.settings.imageZoom ? (await import("medium-zoom/dist/pure")).default : undefined;
			if (!this.isConnected || generation !== this.generation) return;
			if (mediumZoom && !imageZoom) {
				const zoom = mediumZoom({ background: "#00000088" });
				// close() is ignored during the opening animation; finish cleanup once it ends.
				zoom.on("opened", () => {
					if (!zoom.getZoomedImage()?.isConnected) void zoom.close();
				});
				imageZoom = zoom;
			}
			this.zoom = mediumZoom ? imageZoom : undefined;
			const scope = `[data-artalk-instance="${this.dataset.artalkInstance}"]`;
			const instance = Artalk.init({
				...this.settings.client,
				el: this.querySelector<HTMLElement>("[data-artalk-mount]")!,
				darkMode: document.documentElement.dataset.theme === "dark",
				countEl: `${scope} [data-artalk-count]`,
				pvEl: `${scope} [data-artalk-views]`,
				pageVote: this.settings.pageVote
					? {
							upBtnEl: `${scope} [data-artalk-up]`,
							downBtnEl: `${scope} [data-artalk-down]`,
							upCountEl: `${scope} [data-artalk-up-count]`,
							downCountEl: `${scope} [data-artalk-down-count]`,
							activeClass: "artalk-voted"
						}
					: false
			});
			this.instance = instance;
			status.hidden = true;
			// Artalk 2.10's configuration-error retry does not emit its mounted lifecycle.
			// Recreate the instance on our retry so navigation, voting and theme hooks recover too.
			this.mountError = new MutationObserver(() => {
				if (!instance.getEl().querySelector(".error-message")) return;
				this.mountError?.disconnect();
				instance.destroy();
				this.instance = undefined;
				this.zoom?.detach();
				status.textContent = this.dataset.error!;
				status.hidden = false;
				retry.hidden = false;
			});
			this.mountError.observe(instance.getEl(), { childList: true, subtree: true });
			const syncScheme = () => {
				const dark = document.documentElement.dataset.theme === "dark";
				if (instance.getConf().darkMode !== dark) instance.setDarkMode(dark);
			};
			instance.on("mounted", () => {
				// Artalk fetches its backend configuration asynchronously during construction.
				if (!this.isConnected || generation !== this.generation) {
					instance.destroy();
					return;
				}
				this.mountError?.disconnect();
				status.hidden = true;
				syncScheme();
				this.scheme = new MutationObserver(syncScheme);
				this.scheme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
				this.votes = new MutationObserver(() => {
					for (const button of this.querySelectorAll("[data-artalk-up], [data-artalk-down]")) {
						button.setAttribute("aria-pressed", String(button.classList.contains("artalk-voted")));
					}
				});
				this.votes.observe(this, { subtree: true, attributes: true, attributeFilter: ["class"] });
				this.dispatchEvent(new CustomEvent<ArtalkReadyDetail>("artalk:ready", { bubbles: true, detail: { artalk: instance } }));
			});
			instance.on("list-fetched", () => {
				if (!this.isConnected || generation !== this.generation) return;
				for (const button of this.querySelectorAll<HTMLButtonElement>("[data-artalk-up], [data-artalk-down]")) button.disabled = false;
			});
			const refreshCounts = () => {
				if (this.settings.statistics && this.isConnected && generation === this.generation) Artalk.loadCountWidget(instance.getConf());
			};
			instance.on("comment-inserted", refreshCounts);
			instance.on("comment-deleted", refreshCounts);
			instance.on("comment-rendered", comment => {
				if (!this.isConnected || generation !== this.generation) return;
				const removed = this.zoom?.getImages().filter(image => !image.isConnected) ?? [];
				if (removed.length) this.zoom?.detach(...removed);
				this.zoom?.attach(comment.getEl().querySelectorAll(".atk-content img:not(.atk-emoticon)"));
			});
		} catch (error) {
			if (!this.isConnected || generation !== this.generation) return;
			status.textContent = this.dataset.error!;
			status.hidden = false;
			// Browsers can cache failed module imports; a fresh document retries the asset fetch.
			retry.onclick = () => window.location.reload();
			retry.hidden = false;
			console.error("Could not load Artalk", error);
		} finally {
			if (generation === this.generation) this.loading = false;
		}
	}

	disconnectedCallback() {
		this.generation++;
		this.visibility?.disconnect();
		this.scheme?.disconnect();
		this.votes?.disconnect();
		this.mountError?.disconnect();
		void this.zoom?.close();
		this.zoom?.detach();
		this.instance?.destroy();
		this.instance = undefined;
		this.loading = false;
	}
}

if (!customElements.get("artalk-comments")) customElements.define("artalk-comments", ArtalkComments);
