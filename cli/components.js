const { marked } = require('marked');

/**
 * Process component definitions and usages in markdown content.
 * This runs BEFORE slide parsing — it transforms markdown text.
 *
 * Processing order:
 *   1. Extract and remove custom @component definitions
 *   2. Expand built-in components (@columns, @comparison, etc.)
 *   3. Expand custom @use directives
 *
 * @param {string} content - Raw markdown content (after frontmatter extraction)
 * @returns {string} - Markdown with components expanded
 */
function processComponents(content) {
	// Step 1: Extract and remove custom component definitions
	const components = {};
	content = extractComponentDefinitions(content, components);

	// Step 2: Expand built-in components
	content = expandColumns(content);
	content = expandComparison(content);
	content = expandTimeline(content);
	content = expandQuote(content);
	content = expandStats(content);
	content = expandCards(content);
	content = expandImageText(content);
	content = expandIconList(content);

	// Step 3: Expand custom @use directives
	content = expandCustomUsages(content, components);

	return content;
}

// ---------------------------------------------------------------------------
// Attribute parsing
// ---------------------------------------------------------------------------

/**
 * Parse attributes from a string like: name="Knut" role="Creator" simple=value
 * Supports both key="value with spaces" and key=simplevalue formats.
 * @param {string} str
 * @returns {Object}
 */
function parseAttributes(str) {
	const attrs = {};
	if (!str) return attrs;
	const regex = /([\w-]+)=(?:"([^"]*)"|(\S+))/g;
	let m;
	while ((m = regex.exec(str)) !== null) {
		attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
	}
	return attrs;
}

// ---------------------------------------------------------------------------
// Custom component definitions & usages
// ---------------------------------------------------------------------------

/**
 * Extract all <!-- @component: NAME -->...<!-- @end --> blocks.
 * Stores templates keyed by name. Removes definitions from content.
 */
function extractComponentDefinitions(content, components) {
	const regex = /<!--\s*@component:\s*([\w-]+)\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, name, template) => {
		components[name] = template.trimEnd();
		return '';
	});
}

/**
 * Expand all <!-- @use: NAME key="value" ... --> directives using stored templates.
 */
function expandCustomUsages(content, components) {
	const regex = /<!--\s*@use:\s*([\w-]+)\s*(.*?)\s*-->/g;
	return content.replace(regex, (_, name, attrStr) => {
		const template = components[name];
		if (!template) return `<!-- unknown component: ${name} -->`;
		const attrs = parseAttributes(attrStr);
		let result = template;
		for (const [key, value] of Object.entries(attrs)) {
			result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
		}
		return result;
	});
}

// ---------------------------------------------------------------------------
// Built-in components
// ---------------------------------------------------------------------------

/**
 * @columns ... @col ... @end  →  multi-column layout
 */
function expandColumns(content) {
	const regex = /<!--\s*@columns\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, inner) => {
		const cols = inner.split(/<!--\s*@col\s*-->/);
		const colsHTML = cols
			.map((col) => {
				const html = marked(col.trim());
				return `<div class="anna-col">\n${html}\n</div>`;
			})
			.join('\n');
		return `<div class="anna-columns">\n${colsHTML}\n</div>`;
	});
}

/**
 * @comparison pros="Pros" cons="Cons" ... @vs ... @end  →  side-by-side comparison
 */
function expandComparison(content) {
	const regex = /<!--\s*@comparison\s+(.*?)\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, attrStr, inner) => {
		const attrs = parseAttributes(attrStr);
		const prosLabel = attrs.pros || 'Pros';
		const consLabel = attrs.cons || 'Cons';
		const sides = inner.split(/<!--\s*@vs\s*-->/);
		const prosContent = sides[0] ? marked(sides[0].trim()) : '';
		const consContent = sides[1] ? marked(sides[1].trim()) : '';
		return (
			`<div class="anna-comparison">\n` +
			`<div class="anna-comparison-side anna-comparison-pros">\n` +
			`<h4 class="anna-comparison-heading">✓ ${prosLabel}</h4>\n` +
			`${prosContent}\n` +
			`</div>\n` +
			`<div class="anna-comparison-side anna-comparison-cons">\n` +
			`<h4 class="anna-comparison-heading">✗ ${consLabel}</h4>\n` +
			`${consContent}\n` +
			`</div>\n` +
			`</div>`
		);
	});
}

/**
 * @timeline ... @end  →  vertical timeline
 * Each `- ` list item becomes a timeline item.
 */
function expandTimeline(content) {
	const regex = /<!--\s*@timeline\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, inner) => {
		const items = inner
			.trim()
			.split('\n')
			.map((l) => l.replace(/^[-*]\s*/, '').trim())
			.filter((l) => l.length > 0);
		const itemsHTML = items
			.map((item) => {
				const html = marked.parseInline(item);
				return (
					`<div class="anna-timeline-item">\n` +
					`<div class="anna-timeline-dot"></div>\n` +
					`<div class="anna-timeline-content">${html}</div>\n` +
					`</div>`
				);
			})
			.join('\n');
		return `<div class="anna-timeline">\n${itemsHTML}\n</div>`;
	});
}

/**
 * @quote author="Name" ... @end  →  styled blockquote with attribution
 */
function expandQuote(content) {
	const regex = /<!--\s*@quote\s+(.*?)\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, attrStr, inner) => {
		const attrs = parseAttributes(attrStr);
		const author = attrs.author || '';
		const text = inner.trim();
		let html = `<div class="anna-quote">\n`;
		html += `<blockquote class="anna-quote-text">${text}</blockquote>\n`;
		if (author) {
			html += `<cite class="anna-quote-author">— ${author}</cite>\n`;
		}
		html += `</div>`;
		return html;
	});
}

/**
 * @stats ... @end  →  big number statistics
 * Each `- VALUE | LABEL` line becomes a stat item.
 */
function expandStats(content) {
	const regex = /<!--\s*@stats\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, inner) => {
		const items = inner
			.trim()
			.split('\n')
			.map((l) => l.replace(/^[-*]\s*/, '').trim())
			.filter((l) => l.length > 0);
		const itemsHTML = items
			.map((item) => {
				const parts = item.split('|').map((p) => p.trim());
				const value = parts[0] || '';
				const label = parts[1] || '';
				return (
					`<div class="anna-stat">\n` +
					`<span class="anna-stat-value">${value}</span>\n` +
					`<span class="anna-stat-label">${label}</span>\n` +
					`</div>`
				);
			})
			.join('\n');
		return `<div class="anna-stats">\n${itemsHTML}\n</div>`;
	});
}

/**
 * @cards ... @end  →  grid of cards
 * Split on `### ` headings. Each heading + content below becomes a card.
 */
function expandCards(content) {
	const regex = /<!--\s*@cards\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, inner) => {
		// Split on ### headings, keeping the heading with each section
		const sections = inner.trim().split(/(?=^### )/m).filter((s) => s.trim());
		const cardsHTML = sections
			.map((section) => {
				const html = marked(section.trim());
				return `<div class="anna-card">\n${html}\n</div>`;
			})
			.join('\n');
		return `<div class="anna-cards">\n${cardsHTML}\n</div>`;
	});
}

/**
 * @image-text src="..." alt="..." side="left|right" ... @end
 * Image with text side-by-side.
 */
function expandImageText(content) {
	const regex = /<!--\s*@image-text\s+(.*?)\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, attrStr, inner) => {
		const attrs = parseAttributes(attrStr);
		const src = attrs.src || '';
		const alt = attrs.alt || '';
		const side = attrs.side || 'left';
		const textHTML = marked(inner.trim());
		return (
			`<div class="anna-image-text anna-image-${side}">\n` +
			`<div class="anna-image-text-img">\n` +
			`<img src="${src}" alt="${alt}">\n` +
			`</div>\n` +
			`<div class="anna-image-text-content">\n` +
			`${textHTML}\n` +
			`</div>\n` +
			`</div>`
		);
	});
}

/**
 * @icon-list ... @end  →  list with large icons/emoji
 * Each `- ICON | TITLE | DESCRIPTION` line becomes an item.
 */
function expandIconList(content) {
	const regex = /<!--\s*@icon-list\s*-->\n?([\s\S]*?)<!--\s*@end\s*-->/g;
	return content.replace(regex, (_, inner) => {
		const items = inner
			.trim()
			.split('\n')
			.map((l) => l.replace(/^[-*]\s*/, '').trim())
			.filter((l) => l.length > 0);
		const itemsHTML = items
			.map((item) => {
				const parts = item.split('|').map((p) => p.trim());
				const icon = parts[0] || '';
				const title = parts[1] ? marked.parseInline(parts[1]) : '';
				const desc = parts[2] || '';
				return (
					`<div class="anna-icon-list-item">\n` +
					`<span class="anna-icon-list-icon">${icon}</span>\n` +
					`<div class="anna-icon-list-body">\n` +
					`${title}\n` +
					`<span class="anna-icon-list-desc">${desc}</span>\n` +
					`</div>\n` +
					`</div>`
				);
			})
			.join('\n');
		return `<div class="anna-icon-list">\n${itemsHTML}\n</div>`;
	});
}

module.exports = { processComponents };
