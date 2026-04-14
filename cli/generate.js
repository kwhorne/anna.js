/**
 * Anna.js Markdown-to-Presentation Generator
 *
 * Markdown format:
 *   - YAML frontmatter for configuration (theme, transition, title, etc.)
 *   - `---` separates horizontal slides
 *   - `--` separates vertical slides within a horizontal section
 *   - `Note:` starts speaker notes (until end of slide)
 *   - `<!-- .slide: data-background="#hex" -->` for per-slide attributes
 *   - `<!-- .fragments -->` before a list to animate items one by one
 *   - `![alt](image.jpg)` for images (auto-sized to fit slides)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// --- Public API ---

function run(args) {
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		console.log(`
  Anna.js Markdown Generator

  Usage:
    anna generate <input.md> [output.html]

  Options:
    --watch, -w    Watch for changes and regenerate
    --help, -h     Show this help

  Markdown format:
    ---            Horizontal slide separator
    --             Vertical slide separator
    Note:          Speaker notes (until end of slide)

  Fragment syntax:
    <!-- .fragments -->     Before a list: each item appears one by one
    <!-- .fragment -->      After a paragraph: that paragraph is a fragment

  Slide attributes:
    <!-- .slide: data-background="#4d7e65" -->
    <!-- .slide: data-background-image="img.jpg" -->

  Frontmatter options:
    title          Presentation title
    theme          Theme name (default: league)
    transition     Transition effect (default: slide)
    controls       Show navigation controls (default: true)
    progress       Show progress bar (default: true)
    center         Center slide content (default: true)
    hash           Enable URL hashing (default: true)
		`);
		process.exit(0);
	}

	const watchMode = args.includes('--watch') || args.includes('-w');
	const fileArgs = args.filter(a => !a.startsWith('-'));
	const inputFile = fileArgs[0];
	const outputFile = fileArgs[1] || inputFile.replace(/\.md$/, '.html');

	if (!fs.existsSync(inputFile)) {
		console.error(`  Error: File not found: ${inputFile}`);
		process.exit(1);
	}

	const annaRoot = resolveAnnaRoot(outputFile);

	function doBuild() {
		const html = build(inputFile, { annaRoot });
		fs.writeFileSync(outputFile, html, 'utf-8');
		console.log(`  \u2713 ${inputFile} \u2192 ${outputFile}`);
	}

	doBuild();

	if (watchMode) {
		console.log(`  Watching ${inputFile} for changes...`);
		let timeout;
		fs.watch(inputFile, () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				try { doBuild(); }
				catch (e) { console.error(`  Error: ${e.message}`); }
			}, 100);
		});
	}
}

/**
 * Build HTML from a markdown file. Returns the HTML string.
 */
function build(inputFile, opts = {}) {
	const annaRoot = opts.annaRoot || resolveAnnaRoot(inputFile.replace(/\.md$/, '.html'));
	const raw = fs.readFileSync(inputFile, 'utf-8');
	const { data: config, content } = matter(raw);
	const slides = parseSlides(content);
	return generateHTML(slides, config, annaRoot);
}

function resolveAnnaRoot(outputFile) {
	const rel = path.relative(
		path.dirname(path.resolve(outputFile)),
		path.resolve(__dirname, '..')
	);
	return rel === '' ? '.' : rel;
}

// --- Parser ---

function protectCodeBlocks(text) {
	const blocks = [];
	const protected_ = text.replace(/```[\s\S]*?```/g, match => {
		blocks.push(match);
		return `\x00CODEBLOCK_${blocks.length - 1}\x00`;
	});
	const restore = str => str.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, i) => blocks[i]);
	return { text: protected_, restore };
}

function parseSlides(content) {
	const { text, restore } = protectCodeBlocks(content);

	const horizontalSections = text.split(/\n---\n/);

	return horizontalSections.map(section => {
		const verticalParts = section.split(/\n--\n/);

		if (verticalParts.length === 1) {
			return parseSlide(restore(verticalParts[0]));
		}

		return { vertical: verticalParts.map(s => parseSlide(restore(s))) };
	});
}

function parseSlide(md) {
	const slide = { content: '', notes: null, attrs: {} };

	// Extract slide-level attributes: <!-- .slide: key="value" key2=value2 -->
	const attrMatch = md.match(/<!--\s*\.slide:\s*(.*?)\s*-->/);
	if (attrMatch) {
		md = md.replace(attrMatch[0], '');
		const attrRegex = /([\w-]+)=["']?([^"'\s]+)["']?/g;
		let m;
		while ((m = attrRegex.exec(attrMatch[1])) !== null) {
			slide.attrs[m[1]] = m[2];
		}
	}

	// Extract speaker notes: everything after `Note:` on its own line
	const noteParts = md.split(/\nNote:\s*\n/i);
	const slideMarkdown = noteParts[0].trim();
	if (noteParts.length > 1) {
		slide.notes = marked(noteParts[1].trim());
	}

	// Process ```terminal code blocks into terminal widgets
	let processed = slideMarkdown.replace(
		/```terminal\n([\s\S]*?)```/g,
		(_, content) => {
			return `<div class="terminal" data-title="Terminal">\n${content.trim()}\n</div>`;
		}
	);

	// Process ```mermaid code blocks into mermaid diagrams
	processed = processed.replace(
		/```mermaid\n([\s\S]*?)```/g,
		(_, content) => {
			return `<pre class="mermaid">\n${content.trim()}\n</pre>`;
		}
	);

	// Process ```playground code blocks into live editors
	processed = processed.replace(
		/```playground\s*(html|css|javascript)?\n([\s\S]*?)```/g,
		(_, lang, content) => {
			const language = lang || 'javascript';
			return `<div class="playground" data-lang="${language}">\n${content.trim()}\n</div>`;
		}
	);

	// Process <!-- .fragments --> directive
	processed = processed.replace(
		/<!--\s*\.fragments(?:\s+([\w-]+))?\s*-->\n([\s\S]*?)(?=\n\n|$)/g,
		(_, effect, listBlock) => {
			const html = marked(listBlock.trim());
			const cls = effect ? `fragment ${effect}` : 'fragment';
			return html.replace(/<li>/g, `<li class="${cls}">`);
		}
	);

	// Process <!-- .fragment --> after a paragraph
	processed = processed.replace(
		/^(.+)\n<!--\s*\.fragment(?:\s+([\w-]+))?\s*-->/gm,
		(_, line, effect) => {
			const cls = effect ? `fragment ${effect}` : 'fragment';
			return `<p class="${cls}">${line.trim()}</p>`;
		}
	);

	slide.content = marked(processed);

	return slide;
}

// --- HTML Generation ---

function hasTerminalBlocks(slides) {
	return slides.some(s => {
		if (s.vertical) return s.vertical.some(v => v.content.includes('class="terminal"'));
		return s.content.includes('class="terminal"');
	});
}

function hasPlaygroundBlocks(slides) {
	return slides.some(s => {
		if (s.vertical) return s.vertical.some(v => v.content.includes('class="playground"'));
		return s.content.includes('class="playground"');
	});
}

function hasMermaidBlocks(slides) {
	return slides.some(s => {
		if (s.vertical) return s.vertical.some(v => v.content.includes('class="mermaid"'));
		return s.content.includes('class="mermaid"');
	});
}

const DARK_THEMES = ['black', 'night', 'moon', 'blood', 'league'];

function generateHTML(slides, config, annaRoot) {
	const theme = config.theme || 'league';
	const transition = config.transition || 'slide';
	const title = config.title || 'Anna.js Presentation';
	const author = config.author || '';

	const initOptions = {
		controls: config.controls !== false,
		progress: config.progress !== false,
		center: config.center !== false,
		hash: config.hash !== false,
		transition: transition,
	};

	if (config.autoSlide) initOptions.autoSlide = config.autoSlide;
	if (config.loop) initOptions.loop = true;

	const useTerminal = hasTerminalBlocks(slides);
	const useMermaid = hasMermaidBlocks(slides);
	const usePlayground = hasPlaygroundBlocks(slides);
	const mermaidTheme = DARK_THEMES.includes(theme) ? 'dark' : 'default';

	const slidesHTML = slides.map(slide => {
		if (slide.vertical) {
			const inner = slide.vertical.map(s => renderSlide(s)).join('\n');
			return `\t\t\t\t<section>\n${inner}\n\t\t\t\t</section>`;
		}
		return renderSlide(slide);
	}).join('\n\n');

	const p = annaRoot;

	return `<!doctype html>
<html>
\t<head>
\t\t<meta charset="utf-8">
\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

\t\t<title>${esc(title)}</title>
${author ? `\t\t<meta name="author" content="${esc(author)}">\n` : ''}
\t\t<link rel="stylesheet" href="${p}/css/reset.css">
\t\t<link rel="stylesheet" href="${p}/css/anna.css">
\t\t<link rel="stylesheet" href="${p}/css/theme/${theme}.css">
\t\t<link rel="stylesheet" href="${p}/lib/css/monokai.css">
${useTerminal ? `\t\t<link rel="stylesheet" href="${p}/plugin/terminal/terminal.css">\n` : ''}${useMermaid ? `\t\t<link rel="stylesheet" href="${p}/plugin/mermaid/mermaid.css">\n` : ''}${usePlayground ? `\t\t<link rel="stylesheet" href="${p}/plugin/playground/playground.css">\n` : ''}\t</head>
\t<body>
\t\t<div class="anna">
\t\t\t<div class="slides">
${slidesHTML}
\t\t\t</div>
\t\t</div>

\t\t<script src="${p}/js/anna.js"></script>
${useTerminal ? `\t\t<script src="${p}/plugin/terminal/terminal.js"></script>\n` : ''}${usePlayground ? `\t\t<script src="${p}/plugin/playground/playground.js"></script>\n` : ''}${useMermaid ? `\t\t<script type="module">
\t\t\timport mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
\t\t\tmermaid.initialize({ startOnLoad: true, theme: '${mermaidTheme}' });
\t\t</script>\n` : ''}
\t\t<script>
\t\t\tAnna.initialize({
${Object.entries(initOptions).map(([k, v]) => `\t\t\t\t${k}: ${JSON.stringify(v)}`).join(',\n')},
\t\t\t\tdependencies: [
\t\t\t\t\t{ src: '${p}/plugin/markdown/marked.js' },
\t\t\t\t\t{ src: '${p}/plugin/markdown/markdown.js' },
\t\t\t\t\t{ src: '${p}/plugin/notes/notes.js', async: true },
\t\t\t\t\t{ src: '${p}/plugin/highlight/highlight.js', async: true }
\t\t\t\t]
\t\t\t});
\t\t</script>
\t</body>
</html>
`;
}

function renderSlide(slide) {
	const attrs = Object.entries(slide.attrs)
		.map(([k, v]) => ` ${k}="${esc(v)}"`)
		.join('');

	const notes = slide.notes
		? `\t\t\t\t\t\t<aside class="notes">${slide.notes}</aside>\n`
		: '';

	return `\t\t\t\t\t<section${attrs}>
${slide.content}
${notes}\t\t\t\t\t</section>`;
}

function esc(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Exports ---

module.exports = { run, build };
