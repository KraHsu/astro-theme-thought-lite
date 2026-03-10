import { visit, SKIP } from "unist-util-visit";
import type { Root, RootContent, Paragraph, PhrasingContent, Parent } from "mdast";
import type { InlineMath, Math as ASTMath } from "mdast-util-math";

interface Options {
	enabled?: boolean;
}

function normalizeClass(v: unknown): string[] {
	if (Array.isArray(v)) return v.map(String);
	// Remove empty class tokens, e.g. from "" or extra whitespace.
	if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
	return [];
}

function isInlineDisplayMath(node: InlineMath): boolean {
	const start = node.position?.start.offset;
	const end = node.position?.end.offset;

	if (typeof start !== "number" || typeof end !== "number") return false;

	const srcLen = end - start;
	const valLen = node.value.length;

	// $...$   => srcLen - valLen ~= 2
	// $$...$$ => srcLen - valLen ~= 4
	return srcLen - valLen > 2;
}

function toDisplayMath(node: InlineMath): ASTMath {
	return {
		type: "math",
		value: node.value,
		position: node.position,
		data: {
			...node.data,
			hName: "code",
			hProperties: {
				...node.data?.hProperties,
				className: normalizeClass(node.data?.hProperties?.className).map(c => (c === "math-inline" ? "math-display" : c))
			}
		}
	};
}

function makeParagraph(children: PhrasingContent[]): Paragraph {
	return {
		type: "paragraph",
		children
	};
}

function canReplaceParagraphWithBlocks(parent: Parent | undefined): parent is Parent & { children: RootContent[] } {
	if (!parent || !Array.isArray(parent.children)) return false;

	// No block math allowed in tablecell.
	if ((parent as any).type === "tableCell") return false;

	return true;
}

function remarkInlineDisplayMath(options: Options = {}) {
	const { enabled = true } = options;

	return (tree: Root) => {
		if (!enabled) return;

		visit(tree, "paragraph", (paragraph: Paragraph, index, parent) => {
			if (typeof index !== "number") return;
			if (!canReplaceParagraphWithBlocks(parent as Parent | undefined)) return;

			const blocks: RootContent[] = [];
			let buffer: PhrasingContent[] = [];
			let changed = false;

			for (const child of paragraph.children) {
				if (child.type === "inlineMath" && isInlineDisplayMath(child as InlineMath)) {
					changed = true;

					if (buffer.length > 0) {
						blocks.push(makeParagraph(buffer));
						buffer = [];
					}

					blocks.push(toDisplayMath(child as InlineMath));
				} else {
					buffer.push(child);
				}
			}

			if (!changed) return;

			if (buffer.length > 0) {
				blocks.push(makeParagraph(buffer));
			}

			if (parent) {
				parent.children.splice(index, 1, ...blocks);
			}

			// Skip newly inserted nodes to avoid visiting them again.
			return [SKIP, index + blocks.length];
		});
	};
}

export default remarkInlineDisplayMath;
